"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ErrorState } from "@/components/ui/error-state";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import {
  changePassword,
  updateProfile,
} from "@/lib/api/auth";
import { adminApi } from "@/lib/api/admin";
import { commonTimezones } from "@/lib/timezone";
import { ApiError } from "@/types/api";

export function ProfileView() {
  const { user, refresh, isLoading, can } = useAuth();

  const teamsQuery = useQuery({
    queryKey: ["teams", "profile"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "200" })),
    enabled: !!user && can("teams:view"),
    retry: false,
  });

  if (isLoading && !user) return <DetailSkeleton />;
  if (!user) {
    return <ErrorState title="Not signed in" description="Sign in to view your profile." />;
  }

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const teamNames = (teamsQuery.data?.data ?? [])
    .filter((t) => (user.teamIds ?? []).includes(t.id))
    .map((t) => t.name);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Profile" }]}
        title="Profile"
        description="Your account details and security settings."
      />

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-section truncate">{user.fullName}</p>
            <p className="text-meta truncate">{user.email}</p>
          </div>
        </div>

        <dl className="mb-4 grid gap-3 sm:grid-cols-2">
          <ReadOnly label="Email" value={user.email} />
          <ReadOnly label="Role" value={user.roleName || user.roleCode} />
          <ReadOnly
            label="Team"
            value={
              teamNames.length > 0
                ? teamNames.join(", ")
                : user.roleCode === "super_admin"
                  ? "Organization-wide (not assigned)"
                  : "—"
            }
          />
          <ReadOnly label="Status" value={user.isActive ? "Active" : "Inactive"} />
        </dl>

        <ProfileForm
          key={`${user.fullName}|${user.phone ?? ""}|${user.timezone ?? "UTC"}`}
          initial={{
            fullName: user.fullName,
            phone: user.phone ?? "",
            timezone: user.timezone || "UTC",
          }}
          onSaved={async () => {
            await refresh();
          }}
        />
      </section>

      <ChangePasswordCard />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ProfileForm({
  initial,
  onSaved,
}: {
  initial: { fullName: string; phone: string; timezone: string };
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = React.useState(initial.fullName);
  const [phone, setPhone] = React.useState(initial.phone);
  const [timezone, setTimezone] = React.useState(initial.timezone);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    fullName.trim() !== initial.fullName.trim() ||
    phone.trim() !== initial.phone.trim() ||
    timezone !== initial.timezone;

  const zones = React.useMemo(() => {
    const list = commonTimezones();
    if (timezone && !list.includes(timezone)) return [timezone, ...list];
    return list;
  }, [timezone]);

  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setLoading(true);
          setError(null);
          try {
            await updateProfile({
              fullName: fullName.trim(),
              phone: phone.trim(),
              timezone,
            });
            await onSaved();
            toast.success("Profile updated");
          } catch (err) {
            const message =
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Couldn't update profile";
            setError(message);
            toast.error(message);
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      <h3 className="text-section">Editable details</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label required>Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label required>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={loading} disabled={!dirty || loading}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordCard() {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clientError = (() => {
    if (!newPassword && !confirmPassword) return null;
    if (newPassword.length > 0 && newPassword.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return "New passwords do not match";
    }
    return null;
  })();

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-section">Change password</h3>
      <p className="mt-1 text-meta">
        Other signed-in devices will be signed out. This session stays active.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (clientError) {
            setError(clientError);
            return;
          }
          void (async () => {
            setLoading(true);
            setError(null);
            try {
              await changePassword({ currentPassword, newPassword });
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              await refresh();
              toast.success("Password updated");
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : "Couldn't change password";
              setError(message);
              toast.error(message);
            } finally {
              setLoading(false);
            }
          })();
        }}
      >
        <div className="space-y-1.5">
          <Label required>Current password</Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label required>New password</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="space-y-1.5">
          <Label required>Confirm new password</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error || clientError ? (
          <p className="text-xs text-destructive">{error ?? clientError}</p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={loading}
            disabled={
              loading ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              !!clientError
            }
          >
            Update password
          </Button>
        </div>
      </form>
    </section>
  );
}
