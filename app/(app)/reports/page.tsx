import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { PieChart } from "lucide-react";

export default function ReportsPage() {
  return (
    <PlaceholderPage
      title="Reports"
      description="Build and share operational reports for leadership and teams."
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Reports" }]}
      icon={PieChart}
    />
  );
}
