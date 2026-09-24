import { DealDetailView } from "@/features/deals/deal-detail-view";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DealDetailView dealId={id} />;
}
