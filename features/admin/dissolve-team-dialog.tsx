"use client";

import * as React from "react";
import { Building2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminTeam } from "@/lib/api/admin";

export type DissolveTeamPayload = {
  destinationTeamId?: string;
  newTeamName?: string;
  newTeamDescription?: string;
  moveLeads: boolean;
  formerLeadAction: "unassign" | "deactivate";
};

type DestinationMode = "existing" | "new";

export function DissolveTeamDialog({
  team,
  teams,
  open,
  loading,
  onOpenChange,
  onConfirm,
}: {
  team: AdminTeam | null;
  teams: AdminTeam[];
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: DissolveTeamPayload) => void;
}) {
  const otherTeams = React.useMemo(
    () => (teams ?? []).filter((t) => t.id !== team?.id && t.isActive),
    [teams, team?.id],
  );

  const [mode, setMode] = React.useState<DestinationMode>("existing");
  const [destinationTeamId, setDestinationTeamId] = React.useState("");
  const [newTeamName, setNewTeamName] = React.useState("");
  const [newTeamDescription, setNewTeamDescription] = React.useState("");
  const [moveLeads, setMoveLeads] = React.useState(true);
  const [formerLeadAction, setFormerLeadAction] = React.useState<"unassign" | "deactivate">(
    "unassign",
  );

  React.useEffect(() => {
    if (!open || !team) return;
    setMode(otherTeams.length > 0 ? "existing" : "new");
    setDestinationTeamId(otherTeams[0]?.id ?? "");
    setNewTeamName("");
    setNewTeamDescription("");
    setMoveLeads(true);
    setFormerLeadAction("unassign");
  }, [open, team, otherTeams]);

  if (!team) return null;

  const members = (team.members ?? []).filter((m) => m.roleCode !== "super_admin");
  const salesExecs = members.filter((m) => m.roleCode === "sales_executive");
  const teamLead = members.find((m) => m.id === team.teamLeadUserId) ?? null;

  const selectedDest = otherTeams.find((t) => t.id === destinationTeamId) ?? null;
  const destHasOtherLead =
    mode === "existing" &&
    !!teamLead &&
    !!selectedDest?.teamLeadUserId &&
    selectedDest.teamLeadUserId !== team.teamLeadUserId;

  const needsDestination = members.length > 0;
  const canSubmit =
    !needsDestination ||
    (mode === "existing" ? destinationTeamId !== "" : newTeamName.trim() !== "");

  const summaryParts: string[] = [];
  if (salesExecs.length > 0) {
    summaryParts.push(
      `${salesExecs.length} Sales Executive${salesExecs.length === 1 ? "" : "s"} will move`,
    );
  }
  if (teamLead) {
    if (mode === "new" || !destHasOtherLead) {
      summaryParts.push(`${teamLead.fullName} becomes Team Lead of the destination`);
    } else if (formerLeadAction === "deactivate") {
      summaryParts.push(`${teamLead.fullName} will be deactivated (destination already has a Team Lead)`);
    } else {
      summaryParts.push(
        `${teamLead.fullName} will leave without a team (destination already has a Team Lead)`,
      );
    }
  }
  if (moveLeads) summaryParts.push("Open leads and related records move with the team");

  return (
    <Modal open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Delete “{team.name}”?</ModalTitle>
          <ModalDescription>
            Move people to another team first so nobody is left stranded. You can attach them to an
            existing team or create a new one right here.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="size-3.5 text-foreground-muted" aria-hidden />
              {members.length === 0
                ? "No members on this team"
                : `${members.length} member${members.length === 1 ? "" : "s"}`}
            </div>
            {members.length > 0 ? (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{m.fullName}</span>
                    <span className="shrink-0 text-foreground-subtle">
                      {m.id === team.teamLeadUserId ? "Team Lead" : m.roleName}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {needsDestination ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={otherTeams.length === 0}
                  onClick={() => setMode("existing")}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    mode === "existing"
                      ? "border-brand bg-brand/5 text-foreground"
                      : "border-border text-foreground-muted hover:bg-surface-muted/50",
                    otherTeams.length === 0 && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Building2 className="mb-1 size-3.5" aria-hidden />
                  <span className="block font-medium text-foreground">Existing team</span>
                  <span className="text-xs text-foreground-subtle">Move everyone onto one you already have</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    mode === "new"
                      ? "border-brand bg-brand/5 text-foreground"
                      : "border-border text-foreground-muted hover:bg-surface-muted/50",
                  )}
                >
                  <Plus className="mb-1 size-3.5" aria-hidden />
                  <span className="block font-medium text-foreground">Create new team</span>
                  <span className="text-xs text-foreground-subtle">Name it here and attach people now</span>
                </button>
              </div>

              {mode === "existing" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="dissolve-dest">Move to</Label>
                  <Select value={destinationTeamId} onValueChange={setDestinationTeamId}>
                    <SelectTrigger id="dissolve-dest">
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.teamLeadName ? ` · Lead: ${t.teamLeadName}` : " · No Team Lead"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dissolve-new-name" required>
                      New team name
                    </Label>
                    <Input
                      id="dissolve-new-name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="e.g. Sydney Enterprise"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dissolve-new-desc">Description</Label>
                    <Input
                      id="dissolve-new-desc"
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              )}

              {destHasOtherLead ? (
                <div className="space-y-1.5 rounded-lg border border-border px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    Destination already has a Team Lead
                  </p>
                  <p className="text-xs text-foreground-muted">
                    What should happen to {teamLead?.fullName}?
                  </p>
                  <Select
                    value={formerLeadAction}
                    onValueChange={(v) => setFormerLeadAction(v as "unassign" | "deactivate")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassign">Leave without a team (you can reassign later)</SelectItem>
                      <SelectItem value="deactivate">Deactivate their login</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
          ) : null}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={moveLeads}
              onChange={(e) => setMoveLeads(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Move leads to the destination team</span>
              <span className="block text-xs text-foreground-muted">
                Recommended. Unchecked leaves lead team links cleared when this team is removed.
              </span>
            </span>
          </label>

          {summaryParts.length > 0 ? (
            <ul className="list-disc space-y-1 rounded-lg border border-border bg-surface px-3 py-2 pl-7 text-xs text-foreground-muted">
              {summaryParts.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li className="text-destructive">“{team.name}” will be permanently deleted.</li>
            </ul>
          ) : (
            <p className="text-xs text-foreground-muted">
              This empty team will be permanently deleted. Prefer deactivate if you might need it again.
            </p>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={loading}
            disabled={!canSubmit}
            onClick={() => {
              if (needsDestination && mode === "existing") {
                onConfirm({
                  destinationTeamId,
                  moveLeads,
                  formerLeadAction,
                });
                return;
              }
              if (needsDestination && mode === "new") {
                onConfirm({
                  newTeamName: newTeamName.trim(),
                  newTeamDescription: newTeamDescription.trim(),
                  moveLeads,
                  formerLeadAction,
                });
                return;
              }
              onConfirm({ moveLeads, formerLeadAction });
            }}
          >
            {needsDestination ? "Move people & delete team" : "Delete team"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
