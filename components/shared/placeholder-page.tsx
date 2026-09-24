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
  /** Configuration shell — avoid sales-style "New" CTAs. */
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
        title={admin ? `${title} configuration` : `${title} is ready for the next phase`}
        description={
          admin
            ? "This Control Center module is reserved for platform configuration. Domain workflows will land here without changing the authorization model."
            : "The shell, navigation, and design system are in place. Domain workflows will land here without changing the backend architecture."
        }
      />
    </div>
  );
}
