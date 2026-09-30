"use client";

import Link from "next/link";
import { ChevronRight, Handshake, Plus, Trophy, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/console/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { CustomerProfile } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

type ProfileDeal = CustomerProfile["deals"][number];

const STATUS = {
  open: {
    label: "Open",
    icon: Handshake,
    chip: "bg-brand-soft text-brand",
    pill: "bg-brand-soft text-brand-ink",
    dot: "bg-brand",
  },
  won: {
    label: "Won",
    icon: Trophy,
    chip: "bg-success-soft text-success",
    pill: "bg-success-soft text-success",
    dot: "bg-success",
  },
  lost: {
    label: "Lost",
    icon: XCircle,
    chip: "bg-surface-muted text-ink-muted",
    pill: "bg-surface-muted text-ink-muted",
    dot: "bg-ink-subtle",
  },
} as const;

type StatusKey = keyof typeof STATUS;

const STATUS_ORDER: Record<StatusKey, number> = { open: 0, won: 1, lost: 2 };

function statusKey(status: string): StatusKey {
  return status in STATUS ? (status as StatusKey) : "open";
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "AUD",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Totals are only meaningful when every deal shares one currency. */
function summarize(deals: ProfileDeal[]) {
  const currencies = new Set(deals.map((d) => d.currency || "AUD"));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const bucket = (key: StatusKey) => {
    const items = deals.filter((d) => statusKey(d.status) === key);
    const total = items.reduce((sum, d) => sum + (d.value ?? 0), 0);
    return { count: items.length, total: currency ? formatMoney(total, currency) : null };
  };
  return { open: bucket("open"), won: bucket("won"), lost: bucket("lost") };
}

export function CustomerDealsPanel({
  deals,
  canCreate,
  onCreate,
}: {
  deals: ProfileDeal[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  if (deals.length === 0) {
    return (
      <EmptyState
        title="No deals yet"
        description="Create a deal to start tracking an opportunity for this customer."
        actionLabel={canCreate ? "Create deal" : undefined}
        onAction={canCreate ? onCreate : undefined}
      />
    );
  }

  const sorted = [...deals].sort(
    (a, b) =>
      STATUS_ORDER[statusKey(a.status)] - STATUS_ORDER[statusKey(b.status)] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const summary = summarize(deals);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-section">Deals</h3>
          <p className="text-meta">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} for this customer
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" variant="outline" onClick={onCreate}>
            <Plus className="size-3.5" />
            Create deal
          </Button>
        ) : null}
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        {(["open", "won", "lost"] as const).map((key) => (
          <div key={key} className="rounded-lg border border-border bg-surface px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-meta">
              <span aria-hidden className={cn("size-1.5 rounded-full", STATUS[key].dot)} />
              {STATUS[key].label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-numeral-sm">{summary[key].total ?? summary[key].count}</span>
              {summary[key].total ? (
                <span className="text-meta tabular-nums">
                  {summary[key].count} {summary[key].count === 1 ? "deal" : "deals"}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-2">
        {sorted.map((deal) => {
          const status = STATUS[statusKey(deal.status)];
          const StatusIcon = status.icon;
          return (
            <li key={deal.id}>
              <Link
                href={`/deals/${deal.id}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 transition-[border-color,box-shadow,background-color] duration-150 ease-standard hover:border-brand-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-4 sm:px-4"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", status.chip)}>
                  <StatusIcon aria-hidden className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink group-hover:text-brand">{deal.title}</p>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        status.pill,
                      )}
                    >
                      <span aria-hidden className={cn("size-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
                    {deal.pipelineName ? <span className="truncate">{deal.pipelineName}</span> : null}
                    {deal.pipelineName && deal.stageName ? (
                      <ChevronRight aria-hidden className="size-3 shrink-0 text-ink-subtle" />
                    ) : null}
                    {deal.stageName ? (
                      <span className="rounded-md bg-surface-muted px-1.5 py-px font-medium text-ink-secondary">
                        {deal.stageName}
                      </span>
                    ) : null}
                    <span aria-hidden className="text-ink-subtle">
                      ·
                    </span>
                    <span>Created {formatDate(deal.createdAt)}</span>
                  </div>
                </div>

                {deal.ownerName ? (
                  <div className="hidden shrink-0 items-center gap-2 md:flex">
                    <Avatar name={deal.ownerName} size="sm" />
                    <span className="max-w-32 truncate text-meta text-ink-secondary">{deal.ownerName}</span>
                  </div>
                ) : null}

                <div className="shrink-0 text-right">
                  <p className="text-numeral-sm">{formatMoney(deal.value, deal.currency)}</p>
                  <p className="text-meta">{deal.currency || "AUD"}</p>
                </div>

                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-[color,background-color,translate] duration-150 ease-standard group-hover:translate-x-0.5 group-hover:bg-brand-soft group-hover:text-brand motion-reduce:group-hover:translate-x-0"
                >
                  <ChevronRight className="size-4" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
