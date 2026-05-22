import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PartnerEditPage({ params }: Props) {
  const { id } = await params;
  redirect(`/partner/opportunities/${id}/manage`);
}
