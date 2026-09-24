import { ReferrerProfileView } from "@/features/admin/referrer-profile-view";

export default async function ReferrerProfilePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const allowed = type === "user" || type === "customer" || type === "partner";
  if (!allowed) {
    return <p className="p-4 text-sm text-destructive">Invalid referrer type.</p>;
  }
  return <ReferrerProfileView type={type} id={id} />;
}
