"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { referralsApi } from "@/lib/api/referrals";

export function ReferrerProfileView({
  type,
  id,
}: {
  type: "user" | "customer" | "partner";
  id: string;
}) {
  const query = useQuery({
    queryKey: ["referrer-profile", type, id],
    queryFn: () => referralsApi.referrerProfile(type, id),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const p = query.data;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Referrals", href: "/admin/referrals" },
          { label: p.referrerDisplayName },
        ]}
        title={p.referrerDisplayName}
        description={`${p.referrerTypeName} · referral history`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Total referrals" value={p.totalReferrals} />
        <Metric label="Active referrals" value={p.activeReferrals} />
        <Metric label="Converted referrals" value={p.convertedReferrals} />
      </div>

      <section className="rounded-lg border border-border bg-surface">
        <h3 className="border-b border-border px-3 py-2 text-sm font-semibold">Referral history</h3>
        {p.history.length === 0 ? (
          <EmptyState title="No referrals" description="This referrer has no linked referrals yet." />
        ) : (
          <ul className="divide-y divide-border">
            {p.history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {r.customerId ? (
                      <Link href={`/customers/${r.customerId}`} className="text-brand hover:underline">
                        {r.referredName ?? "Referred party"}
                      </Link>
                    ) : (
                      r.referredName ?? "Referred party"
                    )}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {[r.referralDate, r.pipelineName, r.stageName, r.ownerName]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusBadge tone={r.isConverted ? "success" : "brand"}>{r.statusName}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
