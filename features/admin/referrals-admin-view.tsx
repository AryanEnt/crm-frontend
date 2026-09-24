"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import {
  referralsApi,
  type Referral,
} from "@/lib/api/referrals";

function formatMoney(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(v);
}

export function ReferralsAdminView() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [referrerType, setReferrerType] = React.useState("all");
  const [pipelineId, setPipelineId] = React.useState("all");
  const [ownerUserId, setOwnerUserId] = React.useState("all");
  const [referrer, setReferrer] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const metaQuery = useQuery({
    queryKey: ["referrals", "meta"],
    queryFn: () => referralsApi.meta(),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "all"],
    queryFn: () => crmApi.listPipelines(""),
  });
  const usersQuery = useQuery({
    queryKey: ["users", "referrals-admin"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "50");
    p.set("offset", "0");
    p.set("sort", "referralDate");
    p.set("order", "desc");
    if (search) p.set("q", search);
    if (status !== "all") p.set("status", status);
    if (referrerType !== "all") p.set("referrerType", referrerType);
    if (pipelineId !== "all") p.set("pipelineId", pipelineId);
    if (ownerUserId !== "all") p.set("ownerUserId", ownerUserId);
    if (referrer) p.set("referrer", referrer);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [search, status, referrerType, pipelineId, ownerUserId, referrer, from, to]);

  const listQuery = useQuery({
    queryKey: ["referrals", "list", params.toString()],
    queryFn: () => referralsApi.list(params),
  });
  const summaryQuery = useQuery({
    queryKey: ["referrals", "summary", params.toString()],
    queryFn: () => referralsApi.summary(params),
  });

  const columns = React.useMemo<ColumnDef<Referral>[]>(
    () => [
      {
        id: "referrer",
        header: ({ column }) => <SortableHeader column={column} title="Referrer" />,
        cell: ({ row }) => {
          const r = row.original;
          let href: string | null = null;
          if (r.referrerCustomerId) href = `/customers/${r.referrerCustomerId}`;
          else if (r.referrerUserId) href = `/admin/referrals/referrers/user/${r.referrerUserId}`;
          else if (r.referrerPartnerId)
            href = `/admin/referrals/referrers/partner/${r.referrerPartnerId}`;
          return href ? (
            <Link href={href} className="text-sm font-medium text-brand hover:underline">
              {r.referrerDisplayName}
            </Link>
          ) : (
            <span className="text-sm font-medium">{r.referrerDisplayName}</span>
          );
        },
      },
      {
        accessorKey: "referrerTypeName",
        header: "Referrer type",
        cell: ({ row }) => row.original.referrerTypeName,
      },
      {
        id: "referred",
        header: "Referred customer",
        cell: ({ row }) => {
          const r = row.original;
          if (r.customerId) {
            return (
              <Link href={`/customers/${r.customerId}`} className="text-brand hover:underline">
                {r.referredName ?? "—"}
              </Link>
            );
          }
          return <span>{r.referredName ?? "—"}</span>;
        },
      },
      {
        accessorKey: "referralDate",
        header: ({ column }) => <SortableHeader column={column} title="Referral date" />,
      },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row }) => row.original.ownerName ?? "—",
      },
      {
        id: "pipeline",
        header: "Pipeline",
        cell: ({ row }) => row.original.pipelineName ?? "—",
      },
      {
        id: "stage",
        header: "Stage",
        cell: ({ row }) => row.original.stageName ?? "—",
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isConverted ? "success" : "brand"}>
            {row.original.statusName}
          </StatusBadge>
        ),
      },
      {
        id: "value",
        header: "Potential value",
        cell: ({ row }) => formatMoney(row.original.potentialValue),
      },
    ],
    [],
  );

  const metrics = summaryQuery.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Referrals"
        description="Structured referral management — separate from lead source."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Total referrals" value={metrics?.totalReferrals ?? "—"} />
        <Metric label="Active" value={metrics?.activeReferrals ?? "—"} />
        <Metric label="Converted" value={metrics?.convertedReferrals ?? "—"} />
        <Metric label="Unconverted" value={metrics?.unconvertedReferrals ?? "—"} />
        <Metric
          label="Referral pipeline value"
          value={
            metrics ? formatMoney(metrics.referralPipelineValue) : "—"
          }
        />
      </div>

      <FilterBar>
        <Input
          placeholder="Search referrer or referred…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(metaQuery.data?.statuses ?? []).map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={referrerType} onValueChange={setReferrerType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Referrer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(metaQuery.data?.referrerTypes ?? []).map((t) => (
              <SelectItem key={t.code} value={t.code}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pipelines</SelectItem>
            {(pipelinesQuery.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerUserId} onValueChange={setOwnerUserId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {(usersQuery.data?.data ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Referrer filter…"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          className="w-[140px]"
        />
        <div className="flex items-center gap-1">
          <Label className="text-[10px]">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px]" />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-[10px]">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px]" />
        </div>
      </FilterBar>

      {listQuery.isLoading ? <LoadingState /> : null}
      {listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : null}
      {listQuery.data ? (
        <DataTable columns={columns} data={listQuery.data.data} />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
