"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "@/lib/image-processing";
import { findOrCreatePendingArtist } from "@/lib/artist-stub";
import { revalidateHolderPublicSurfaces } from "@/lib/collection";
import { mintUniqueLedgerId } from "@/lib/ledger";
import { sendArtistAttributionEmail } from "@/lib/email";
import type {
  ArtworkSourceDocumentType,
  CollectionSourceType,
} from "@/types/database";

const ARTWORK_BUCKET = "portfolio";
const SOURCE_DOCS_BUCKET = "artwork-source-documents";

const VALID_SOURCE_TYPES: CollectionSourceType[] = [
  "directly_from_artist",
  "gallery",
  "auction",
  "gift",
  "inheritance",
  "other",
];

const VALID_DOC_TYPES: ArtworkSourceDocumentType[] = [
  "certificate",
  "invoice",
  "receipt",
  "other",
];

interface CreateInput {
  title: string;
  attributedArtistText?: string | null;
  attributedArtistId?: string | null;
  // Optional contact email for the unregistered artist — feeds the stub so
  // Phase 2 outreach can reach them. Ignored when attributedArtistId is set.
  attributedArtistEmail?: string | null;
  medium?: string | null;
  year?: number | null;
  dimensions?: string | null;
  edition?: string | null;
  caption?: string | null;
  description?: string | null;
  imageFile: File;
  // Membership-side fields
  dateAcquiredText?: string | null;
  sourceType?: CollectionSourceType | null;
  sourceName?: string | null;
  pricePaidAmount?: number | null;
  pricePaidCurrency?: string | null;
  locationText?: string | null;
  certificateStatement?: string | null;
}

export async function createCollectionEntry(
  input: CreateInput,
): Promise<{ membershipId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const title = (input.title ?? "").trim();
  if (!title) return { error: "Title is required." };

  const attributedText = (input.attributedArtistText ?? "").trim() || null;
  const attributedId = input.attributedArtistId || null;
  if (!attributedText && !attributedId) {
    return { error: "Artist name is required." };
  }

  if (!(input.imageFile instanceof File) || input.imageFile.size === 0) {
    return { error: "An image of the work is required." };
  }
  if (input.imageFile.size > 15 * 1024 * 1024) {
    return { error: "Image must be under 15 MB." };
  }
  if (!input.imageFile.type.startsWith("image/")) {
    return { error: "Uploaded file must be an image." };
  }
  if (input.sourceType && !VALID_SOURCE_TYPES.includes(input.sourceType)) {
    return { error: "Invalid source type." };
  }

  const admin = createAdminClient();

  // 1. Upload the image — convert to WebP via Sharp
  const id = randomBytes(8).toString("hex");
  const imagePath = `${user.id}/collection/${id}.webp`;

  const imgBytes = await input.imageFile.arrayBuffer();
  const { data: processedImg } = await processImage(Buffer.from(imgBytes), { maxWidth: 1600, quality: 90 });

  const { error: uploadError } = await admin.storage
    .from(ARTWORK_BUCKET)
    .upload(imagePath, processedImg, {
      contentType: "image/webp",
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = admin.storage.from(ARTWORK_BUCKET).getPublicUrl(imagePath);

  // 2. Resolve attribution. If the holder picked a Patronage profile we
  //    route the claim to that artist. Otherwise we find or create a
  //    pending_artists stub keyed on (name_normalised, email). Stubs without
  //    email are always fresh — common-name collisions shouldn't auto-merge.
  let pendingArtistId: string | null = null;
  if (!attributedId && attributedText) {
    const stub = await findOrCreatePendingArtist(admin, {
      name: attributedText,
      email: input.attributedArtistEmail?.trim() || null,
      createdByHolderId: user.id,
    });
    if (!stub) {
      await admin.storage.from(ARTWORK_BUCKET).remove([imagePath]);
      return { error: "Couldn't register the artist attribution." };
    }
    pendingArtistId = stub.id;
  }

  // 3. Mint a unique ledger ID up-front so the artwork insert and the
  //    initial ledger row stay in lock-step. The PDF certificate generator
  //    (Phase 3) keys off artworks.ledger_id.
  let ledgerId: string;
  try {
    ledgerId = await mintUniqueLedgerId(admin);
  } catch (e) {
    await admin.storage.from(ARTWORK_BUCKET).remove([imagePath]);
    return { error: e instanceof Error ? e.message : "Couldn't mint ledger ID." };
  }

  // 4. Insert artwork row. For holder_uploaded works the holder is also set
  //    as creator_id/profile_id/current_owner_id so existing RLS keeps
  //    working. The actual creator attribution lives in
  //    attributed_artist_id (real profile) or attributed_pending_artist_id
  //    (stub). Phase 2 confirmation re-points creator_id at the real artist.
  const { data: artwork, error: artworkError } = await admin
    .from("artworks")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      url: publicUrl,
      title,
      caption: input.caption?.trim() || null,
      description: input.description?.trim() || null,
      year: input.year ?? null,
      medium: input.medium?.trim() || null,
      dimensions: input.dimensions?.trim() || null,
      edition: input.edition?.trim() || null,
      is_available: false,
      hide_available: true,
      hide_from_archive: true,
      collection_visible: false,
      source: "holder_uploaded",
      attributed_artist_text: attributedText,
      attributed_artist_id: attributedId,
      attributed_pending_artist_id: pendingArtistId,
      ledger_id: ledgerId,
    })
    .select("id")
    .single();

  if (artworkError || !artwork) {
    await admin.storage.from(ARTWORK_BUCKET).remove([imagePath]);
    return { error: artworkError?.message ?? "Failed to create artwork." };
  }

  // Initial 'created' ledger entry — transfer_method='imported' so the chain
  // of custody reads truthfully ("imported by holder", not "listed").
  await admin.from("artwork_provenance_ledger").insert({
    artwork_id: artwork.id,
    ledger_id: ledgerId,
    entry_type: "created",
    from_owner_id: null,
    to_owner_id: user.id,
    transfer_method: "imported",
    transferred_at: new Date().toISOString(),
  });

  // 5. Open a holder_attribution_claims row pointing at either the real
  //    profile or the stub. Phase 2's confirmation dashboard reads this.
  const { error: claimError } = await admin
    .from("holder_attribution_claims")
    .insert({
      artwork_id: artwork.id,
      holder_id: user.id,
      target_profile_id: attributedId,
      target_pending_artist_id: pendingArtistId,
      status: "pending",
    });
  if (claimError) {
    // Roll back artwork + image so we don't leak orphaned records.
    await admin.from("artworks").delete().eq("id", artwork.id);
    await admin.storage.from(ARTWORK_BUCKET).remove([imagePath]);
    return { error: claimError.message };
  }

  // 6. Insert collection_membership row.
  const { data: existingPositions } = await admin
    .from("collection_membership")
    .select("position")
    .eq("holder_id", user.id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition =
    existingPositions?.[0]?.position != null ? existingPositions[0].position + 1 : 0;

  const { data: membership, error: membershipError } = await admin
    .from("collection_membership")
    .insert({
      holder_id: user.id,
      artwork_id: artwork.id,
      position: nextPosition,
      date_acquired_text: input.dateAcquiredText?.trim() || null,
      source_type: input.sourceType ?? null,
      source_name: input.sourceName?.trim() || null,
      price_paid_amount: input.pricePaidAmount ?? null,
      price_paid_currency: input.pricePaidCurrency?.trim() || null,
      location_text: input.locationText?.trim() || null,
      certificate_statement: input.certificateStatement?.trim() || null,
    })
    .select("id")
    .single();

  if (membershipError || !membership) {
    // Roll back the artwork + claim cascades via FK ON DELETE CASCADE.
    await admin.from("artworks").delete().eq("id", artwork.id);
    await admin.storage.from(ARTWORK_BUCKET).remove([imagePath]);
    return { error: membershipError?.message ?? "Failed to add to collection." };
  }

  revalidatePath("/dashboard/collection");

  // Send attribution email if the artist has an email on their stub (fire-and-forget)
  if (pendingArtistId && input.attributedArtistEmail?.trim()) {
    (async () => {
      const { data: stub } = await admin
        .from("pending_artists")
        .select("claim_token, email")
        .eq("id", pendingArtistId)
        .maybeSingle();
      if (!stub?.email || !stub.claim_token) return;
      const { data: holderProfile } = await admin
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();
      const holderName = holderProfile?.full_name ?? holderProfile?.username ?? "A collector";
      await sendArtistAttributionEmail({
        toEmail: stub.email,
        artistName: input.attributedArtistText ?? "Artist",
        holderName,
        artworkTitle: title,
        claimToken: stub.claim_token,
      });
    })().catch(console.error);
  }

  return { membershipId: membership.id };
}

export async function togglePublic(
  membershipId: string,
  isPublic: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("collection_membership")
    .update({ is_public: isPublic })
    .eq("id", membershipId)
    .eq("holder_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}

interface UpdateFields {
  dateAcquiredText?: string | null;
  sourceType?: CollectionSourceType | null;
  sourceName?: string | null;
  pricePaidAmount?: number | null;
  pricePaidCurrency?: string | null;
  locationText?: string | null;
  showLocationPublicly?: boolean;
  certificateStatement?: string | null;
}

export async function updateMembership(
  membershipId: string,
  fields: UpdateFields,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (fields.sourceType && !VALID_SOURCE_TYPES.includes(fields.sourceType)) {
    return { error: "Invalid source type." };
  }

  const patch: Record<string, unknown> = {};
  if (fields.dateAcquiredText !== undefined)
    patch.date_acquired_text = fields.dateAcquiredText?.trim() || null;
  if (fields.sourceType !== undefined) patch.source_type = fields.sourceType ?? null;
  if (fields.sourceName !== undefined)
    patch.source_name = fields.sourceName?.trim() || null;
  if (fields.pricePaidAmount !== undefined) patch.price_paid_amount = fields.pricePaidAmount ?? null;
  if (fields.pricePaidCurrency !== undefined)
    patch.price_paid_currency = fields.pricePaidCurrency?.trim() || null;
  if (fields.locationText !== undefined)
    patch.location_text = fields.locationText?.trim() || null;
  if (fields.showLocationPublicly !== undefined)
    patch.show_location_publicly = fields.showLocationPublicly;
  if (fields.certificateStatement !== undefined)
    patch.certificate_statement = fields.certificateStatement?.trim() || null;

  if (Object.keys(patch).length === 0) return {};

  const { error } = await supabase
    .from("collection_membership")
    .update(patch)
    .eq("id", membershipId)
    .eq("holder_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  revalidatePath(`/dashboard/collection/${membershipId}`);
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}

export async function updateCollectionArtwork(
  artworkId: string,
  fields: {
    title?: string | null;
    year?: number | null;
    medium?: string | null;
    dimensions?: string | null;
    edition?: string | null;
    description?: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify caller owns this artwork via collection_membership
  const { data: membership } = await supabase
    .from("collection_membership")
    .select("id")
    .eq("artwork_id", artworkId)
    .eq("holder_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Not authorised." };

  const { error } = await supabase
    .from("artworks")
    .update({
      title: fields.title?.trim() || null,
      year: fields.year ?? null,
      medium: fields.medium?.trim() || null,
      dimensions: fields.dimensions?.trim() || null,
      edition: fields.edition?.trim() || null,
      description: fields.description?.trim() || null,
    })
    .eq("id", artworkId)
    .eq("current_owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}

export async function removeFromCollection(
  membershipId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("collection_membership")
    .delete()
    .eq("id", membershipId)
    .eq("holder_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}

export async function uploadSourceDocument(
  form: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const artworkId = String(form.get("artworkId") ?? "");
  const documentType = String(form.get("documentType") ?? "") as ArtworkSourceDocumentType;
  const description = String(form.get("description") ?? "").trim() || null;
  const file = form.get("file");

  if (!artworkId) return { error: "Missing artwork ID." };
  if (!VALID_DOC_TYPES.includes(documentType))
    return { error: "Invalid document type." };
  if (!(file instanceof File)) return { error: "No file uploaded." };
  if (file.size > 20 * 1024 * 1024) return { error: "File must be under 20 MB." };

  // Verify caller owns the artwork via collection_membership
  const { data: membership } = await supabase
    .from("collection_membership")
    .select("id")
    .eq("artwork_id", artworkId)
    .eq("holder_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "You can only upload documents for works in your collection." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "pdf")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "pdf";
  const id = randomBytes(8).toString("hex");
  const path = `${user.id}/${artworkId}/${documentType}-${id}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(SOURCE_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await admin
    .from("artwork_source_documents")
    .insert({
      artwork_id: artworkId,
      uploaded_by: user.id,
      storage_path: path,
      document_type: documentType,
      description,
    });

  if (insertError) {
    await admin.storage.from(SOURCE_DOCS_BUCKET).remove([path]);
    return { error: insertError.message };
  }

  revalidatePath(`/dashboard/collection`);
  return {};
}

export async function deleteSourceDocument(
  documentId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: doc } = await supabase
    .from("artwork_source_documents")
    .select("id, storage_path, uploaded_by")
    .eq("id", documentId)
    .eq("uploaded_by", user.id)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const admin = createAdminClient();
  await admin.storage.from(SOURCE_DOCS_BUCKET).remove([doc.storage_path]);

  const { error } = await admin
    .from("artwork_source_documents")
    .delete()
    .eq("id", documentId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/collection");
  return {};
}

/**
 * Bulk-set is_public on a list of membership rows owned by the caller. Used
 * by the "Select all → Make public" toolbar so a holder importing 100 works
 * doesn't have to flip them one at a time.
 */
export async function bulkSetPublic(
  membershipIds: string[],
  isPublic: boolean,
): Promise<{ error?: string; updated: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", updated: 0 };
  if (membershipIds.length === 0) return { updated: 0 };

  const { error, count } = await supabase
    .from("collection_membership")
    .update({ is_public: isPublic }, { count: "exact" })
    .in("id", membershipIds)
    .eq("holder_id", user.id);

  if (error) return { error: error.message, updated: 0 };
  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return { updated: count ?? 0 };
}

export async function reorderCollection(
  orderedIds: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const updates = orderedIds.map((id, position) =>
    supabase
      .from("collection_membership")
      .update({ position })
      .eq("id", id)
      .eq("holder_id", user.id),
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { error: firstError.message };

  revalidatePath("/dashboard/collection");
  await revalidateHolderPublicSurfaces(user.id);
  return {};
}

/**
 * Search published profiles by name/username for the artist typeahead in
 * the upload form. Public read; small result set; case-insensitive.
 */
/**
 * Re-sends (or sends for the first time) the provenance certificate for a
 * collected artwork. Includes the collector's uploaded source documents as
 * additional reference photos so they appear in the PDF alongside the
 * artist's documentation photos.
 *
 * Only the current owner can request a cert for their own work.
 */
export async function requestCertificate(artworkId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: artwork } = await admin
    .from("artworks")
    .select("id, ledger_id, title, caption, url, year, medium, dimensions, edition, certificate_note, creator_id, current_owner_id, is_available")
    .eq("id", artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };
  if (artwork.current_owner_id !== user.id) return { error: "You don't own this work." };
  if (!artwork.ledger_id) return { error: "No provenance record exists for this work yet." };

  const [{ data: sourceDocs }, { data: artistProfile }, { data: branding }] = await Promise.all([
    admin.from("artwork_source_documents").select("*").eq("artwork_id", artworkId).eq("uploaded_by", user.id).order("created_at", { ascending: true }),
    admin.from("profiles").select("full_name, username").eq("id", artwork.creator_id).maybeSingle(),
    admin.from("profiles").select("provenance_logo_url, provenance_signature_url").eq("id", artwork.creator_id).maybeSingle(),
  ]);

  const { data: buyerProfile } = await admin.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle();

  // Build signed URLs for image-format source documents
  const imagePaths = (sourceDocs ?? [])
    .map(d => d.storage_path)
    .filter(p => /\.(jpe?g|png|webp|gif)$/i.test(p));

  let sourceDocRefs: Array<{ label: string; url: string }> = [];
  if (imagePaths.length > 0) {
    const { data: signed } = await admin.storage
      .from("artwork-source-documents")
      .createSignedUrls(imagePaths, 3600);
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
    sourceDocRefs = (sourceDocs ?? [])
      .filter(d => /\.(jpe?g|png|webp|gif)$/i.test(d.storage_path) && urlByPath.has(d.storage_path))
      .map(d => ({
        label: d.document_type === "certificate" ? "Existing certificate"
          : d.document_type === "invoice" ? "Invoice"
          : d.document_type === "receipt" ? "Receipt"
          : "Supporting document",
        url: urlByPath.get(d.storage_path)!,
      }));
  }

  const { sendTransferCertificate } = await import("@/lib/pdf/transfer-certificate");
  sendTransferCertificate({
    artistId: artwork.creator_id,
    buyerId: user.id,
    ledgerId: artwork.ledger_id as string,
    workTitle: artwork.title ?? artwork.caption ?? "Untitled",
    workImageUrl: artwork.url ?? null,
    artistName: artistProfile?.full_name ?? artistProfile?.username ?? "The artist",
    artistUsername: artistProfile?.username ?? null,
    patronName: buyerProfile?.full_name ?? buyerProfile?.username ?? "Collector",
    yearCreated: (artwork as { year?: number | null }).year ?? null,
    medium: (artwork as { medium?: string | null }).medium ?? null,
    dimensions: (artwork as { dimensions?: string | null }).dimensions ?? null,
    edition: (artwork as { edition?: string | null }).edition ?? null,
    certificateNote: (artwork as { certificate_note?: string | null }).certificate_note ?? null,
    logoUrl: branding?.provenance_logo_url ?? null,
    signatureUrl: branding?.provenance_signature_url ?? null,
    artworkId,
    referencePhotos: sourceDocRefs.length > 0 ? sourceDocRefs : undefined,
    isNewAccount: false,
  }).catch(console.error);

  return {};
}

export async function searchProfiles(query: string): Promise<
  { id: string; username: string; full_name: string | null; avatar_url: string | null }[]
> {
  const supabase = await createClient();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("is_active", true)
    .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
    .limit(8);

  return data ?? [];
}
