import { Customer360View } from "@/features/customers/customer-360-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Customer360View customerId={id} />;
}
