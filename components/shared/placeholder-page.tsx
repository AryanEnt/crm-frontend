import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import type { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  breadcrumbs,
  icon,
  admin = false,
}: {
  title: string;
  description: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  icon?: LucideIcon;
  /** Setup shell — avoid sales-style "New" CTAs. */
  admin?: boolean;
}) {
  return (
    <div>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        actions={
          admin ? (
            <Button variant="outline" size="sm" disabled>
              Coming soon
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm">
                Export
              </Button>
              <Button size="sm">New</Button>
            </>
          )
        }
      />
      <EmptyState
        icon={icon}
        title={admin ? `${title} is not ready yet` : `${title} is on the way`}
        description={
          admin
            ? "This Control Center page is reserved for setup. Workflows will land here without changing who can access what."
            : "Navigation and layout are ready. Day-to-day workflows for this area will appear here next."
        }
      />
    </div>
  );
}
