"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";

/**
 * Read-only governance lookup for Super Admin.
 * No sales actions (create activity, move stage, send WhatsApp, etc.).
 */
export default function AdminLookupPage() {
  const { can } = useAuth();
  const [q, setQ] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");

  const enabled = submitted.length >= 2;

  const leadsQuery = useQuery({
    queryKey: ["lookup", "leads", submitted],
    queryFn: () =>
      crmApi.listLeads(new URLSearchParams({ q: submitted, limit: "8" })),
    enabled: enabled && can("leads:view"),
  });
  const customersQuery = useQuery({
    queryKey: ["lookup", "customers", submitted],
    queryFn: () =>
      crmApi.listCustomers(new URLSearchParams({ q: submitted, limit: "8" })),
    enabled: enabled && can("customers:view"),
  });
  const dealsQuery = useQuery({
    queryKey: ["lookup", "deals", submitted],
    queryFn: () =>
      crmApi.listDeals(new URLSearchParams({ q: submitted, limit: "8" })),
    enabled: enabled && can("deals:view"),
  });
  const usersQuery = useQuery({
    queryKey: ["lookup", "users", submitted],
    queryFn: () =>
      adminApi.listUsers(new URLSearchParams({ q: submitted, limit: "8" })),
    enabled: enabled && can("users:view"),
  });
  const teamsQuery = useQuery({
    queryKey: ["lookup", "teams", submitted],
    queryFn: () =>
      adminApi.listTeams(new URLSearchParams({ q: submitted, limit: "8" })),
    enabled: enabled && can("teams:view"),
  });
  const auditQuery = useQuery({
    queryKey: ["lookup", "audit", submitted],
    queryFn: () =>
      adminApi.listAuditLogs(
        new URLSearchParams({ q: submitted, limit: "8", offset: "0" }),
      ),
    enabled: enabled && can("audit:view"),
  });

  const searching =
    leadsQuery.isFetching ||
    customersQuery.isFetching ||
    dealsQuery.isFetching ||
    usersQuery.isFetching ||
    teamsQuery.isFetching ||
    auditQuery.isFetching;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "Record Lookup" },
        ]}
        title="Global record lookup"
        description="Find leads, customers, deals, users, teams, and audit events. Records are read-only from this administrative context."
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or keyword…"
            className="pl-8"
          />
        </div>
        <Button type="submit" disabled={q.trim().length < 2}>
          Search
        </Button>
      </form>

      {!submitted ? (
        <EmptyState
          icon={Search}
          title="Search the organization"
          description="Use this for governance and investigation — not daily sales operations."
        />
      ) : searching ? (
        <LoadingState label="Searching…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {can("leads:view") ? (
            <LookupSection
              title="Leads"
              empty={!leadsQuery.data?.data?.length}
              items={(leadsQuery.data?.data ?? []).map((l) => ({
                id: l.id,
                primary: l.fullName,
                secondary: l.email || l.source || "—",
                href: `/leads`,
              }))}
            />
          ) : null}
          {can("customers:view") ? (
            <LookupSection
              title="Customers"
              empty={!customersQuery.data?.data?.length}
              items={(customersQuery.data?.data ?? []).map((c) => ({
                id: c.id,
                primary: c.fullName,
                secondary: c.email || "—",
                href: `/customers/${c.id}`,
              }))}
            />
          ) : null}
          {can("deals:view") ? (
            <LookupSection
              title="Deals"
              empty={!dealsQuery.data?.data?.length}
              items={(dealsQuery.data?.data ?? []).map((d) => ({
                id: d.id,
                primary: d.title,
                secondary: d.status || "—",
                href: `/deals/${d.id}`,
              }))}
            />
          ) : null}
          {can("users:view") ? (
            <LookupSection
              title="Users"
              empty={!usersQuery.data?.data?.length}
              items={(usersQuery.data?.data ?? []).map((u) => ({
                id: u.id,
                primary: u.fullName,
                secondary: `${u.email} · ${u.roleName}`,
                href: `/admin/users`,
                badge: u.isActive ? "Active" : "Inactive",
              }))}
            />
          ) : null}
          {can("teams:view") ? (
            <LookupSection
              title="Teams"
              empty={!teamsQuery.data?.data?.length}
              items={(teamsQuery.data?.data ?? []).map((t) => ({
                id: t.id,
                primary: t.name,
                secondary: t.teamLeadName || "No Team Lead",
                href: `/admin/teams`,
              }))}
            />
          ) : null}
          {can("audit:view") ? (
            <LookupSection
              title="Audit events"
              empty={!auditQuery.data?.data?.length}
              items={(auditQuery.data?.data ?? []).map((a) => ({
                id: a.id,
                primary: a.action,
                secondary: `${a.resourceType} · ${a.actorName || "system"}`,
                href: `/admin/audit-logs`,
              }))}
            />
          ) : null}
        </div>
      )}

      <p className="text-[11px] text-foreground-muted">
        Opening a sales record does not grant create/edit/move permissions. Operational actions
        require explicit permissions such as leads:create or deals:edit.
      </p>
    </div>
  );
}

function LookupSection({
  title,
  items,
  empty,
}: {
  title: string;
  empty: boolean;
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    href: string;
    badge?: string;
  }>;
}) {
  return (
    <section className="rounded-md border border-border bg-surface p-3">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {empty ? (
        <p className="text-xs text-foreground-muted">No matches</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-2 py-2 hover:bg-surface-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.primary}</p>
                  <p className="truncate text-[11px] text-foreground-muted">{item.secondary}</p>
                </div>
                {item.badge ? <StatusBadge tone="neutral">{item.badge}</StatusBadge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
