import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/console/avatar";
import type { CallPerson } from "@/lib/api/calls";
import { typeLabel } from "./contact-panel";

function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-caption font-medium", className)}>
      {children}
    </span>
  );
}

const PRIORITY_TAG: Record<string, string> = {
  urgent: "bg-danger-soft text-danger",
  high: "bg-danger-soft text-danger",
  medium: "bg-warning-soft text-warning",
  low: "bg-success-soft text-success",
};

export function PersonCard({ person }: { person: CallPerson }) {
  const priority = person.priority?.toLowerCase();
  const meta: Array<[string, string | null | undefined]> = [
    ["Pipeline", person.pipelineName],
    ["Employer", person.employer],
    ["Phone", person.phone],
    ["Email", person.email],
    ["Assigned to", person.ownerName],
    ["Team", person.teamName],
  ];
  const shown = meta.filter(([, v]) => v && v.trim());

  return (
    <section aria-label="Selected contact" className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={person.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-6 tracking-tight text-ink">{person.fullName}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Tag className="bg-brand-soft text-brand-ink">{typeLabel(person.type)}</Tag>
            {person.stageName ? <Tag className="bg-surface-muted text-ink-secondary">{person.stageName}</Tag> : null}
            {priority && PRIORITY_TAG[priority] ? (
              <Tag className={cn("capitalize", PRIORITY_TAG[priority])}>{priority} priority</Tag>
            ) : null}
          </div>
        </div>
      </div>
      {shown.length ? (
        <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-4 gap-y-3 border-t border-line pt-4">
          {shown.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-overline text-ink-muted">{label}</dt>
              <dd className="mt-0.5 break-words text-body text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
