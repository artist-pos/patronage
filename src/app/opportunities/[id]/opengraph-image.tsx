import { ImageResponse } from "next/og";
import { getOpportunityById } from "@/lib/opportunities";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Opportunity on Patronage";

const BG = "#000000";
const BORDER = "#262626";
const MUTED = "#8f8f8f";
const DIM = "#555555";
const BRAND = "#2a8f89"; // civic teal, lifted for legibility on black

/**
 * Branded preview card for a single opportunity.
 *
 * Listing images are whatever an organiser uploaded — often a square logo, or
 * something well under the 1200x630 that iMessage, Slack and WhatsApp want.
 * Composing them into a fixed card means every shared link previews properly
 * and carries the facts that make someone open it: what it is, where, how
 * much, and when it closes.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opp = await getOpportunityById(id);

  if (!opp) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: 1200,
            height: 630,
            backgroundColor: BG,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-2px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Patronage
        </div>
      ),
      size
    );
  }

  const rawLocation = opp.city ? `${opp.city}, ${opp.country}` : opp.country;
  const location = rawLocation === "Global" ? "Open to all" : rawLocation;
  const value =
    opp.funding_range?.trim() ||
    (opp.funding_amount != null
      ? `$${opp.funding_amount.toLocaleString("en-NZ")}`
      : null);
  const deadline = opp.deadline
    ? new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  // Only absolute http(s) images can be fetched by the renderer.
  const image =
    opp.featured_image_url && /^https?:\/\//i.test(opp.featured_image_url)
      ? opp.featured_image_url
      : null;

  // Long titles get a smaller face rather than an overflowing box.
  const titleSize = opp.title.length > 70 ? 40 : opp.title.length > 42 ? 50 : 62;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: 1200,
          height: 630,
          backgroundColor: BG,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* ── Detail panel ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 52px",
            width: image ? 700 : 1200,
            borderRight: image ? `1px solid ${BORDER}` : "none",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Type pill */}
            <div style={{ display: "flex", marginBottom: 22 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: BRAND,
                  padding: "5px 12px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {opp.type}
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: MUTED,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {opp.organiser}
            </div>

            <div
              style={{
                fontSize: titleSize,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: "-1.5px",
              }}
            >
              {opp.title}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, fontSize: 18, color: MUTED }}>
              {[location, value].filter(Boolean).map((part, i) => (
                <div key={i} style={{ display: "flex" }}>
                  {i > 0 ? `· ${part}` : part}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 18, color: deadline ? "#fff" : MUTED }}>
              {deadline ? `Closes ${deadline}` : "Rolling deadline"}
            </div>
            <div style={{ fontSize: 14, color: DIM, marginTop: 14 }}>patronage.nz</div>
          </div>
        </div>

        {/* ── Listing image ── */}
        {image && (
          <div
            style={{
              display: "flex",
              width: 500,
              height: 630,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              width={500}
              height={630}
              style={{ width: 500, height: 630, objectFit: "cover" }}
            />
          </div>
        )}
      </div>
    ),
    size
  );
}
