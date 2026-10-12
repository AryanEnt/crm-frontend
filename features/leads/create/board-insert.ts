import type { Lead, LeadBoard, LeadBoardCard } from "../../../lib/api/crm.ts";

/**
 * Only unfiltered boards get the optimistic card: with a search, owner, source or value
 * filter on, the new lead may not belong in the column, and the refetch settles it anyway.
 */
export function isUnfilteredBoardKey(key: readonly unknown[], pipelineId: string): boolean {
  if (key[0] !== "lead-board" || key[1] !== pipelineId) return false;
  const qs = new URLSearchParams(typeof key[2] === "string" ? key[2] : "");
  return [...qs.keys()].every((k) => k === "pipelineId");
}

/** Puts the card at the top of its stage and updates the column count and total. */
export function insertLeadCard(board: LeadBoard, card: LeadBoardCard): LeadBoard | null {
  if (!board.stages.some((s) => s.id === card.stageId)) return null;
  return {
    ...board,
    stages: board.stages.map((s) =>
      s.id === card.stageId
        ? {
            ...s,
            count: s.count + 1,
            totalValue: s.totalValue + (card.potentialValue ?? 0),
            leads: [card, ...s.leads],
          }
        : s,
    ),
  };
}

/** Swaps the placeholder for the saved lead so the card opens the real record. */
export function replaceLeadCard(board: LeadBoard, placeholderId: string, card: LeadBoardCard): LeadBoard {
  return {
    ...board,
    stages: board.stages.map((s) =>
      s.leads.some((l) => l.id === placeholderId)
        ? { ...s, leads: s.leads.map((l) => (l.id === placeholderId ? card : l)) }
        : s,
    ),
  };
}

export function cardFromLead(lead: Lead, fallback: LeadBoardCard): LeadBoardCard {
  return {
    ...fallback,
    id: lead.id,
    fullName: lead.fullName,
    employer: lead.employer ?? fallback.employer,
    phone: lead.phone ?? null,
    email: lead.email ?? null,
    potentialValue: lead.potentialValue ?? null,
    currency: lead.currency || fallback.currency,
    stageId: lead.stageId ?? fallback.stageId,
    status: lead.status || fallback.status,
    ownerUserId: lead.ownerUserId ?? null,
    ownerName: lead.ownerName ?? fallback.ownerName,
    priority: lead.priority || fallback.priority,
    tags: lead.tags ?? [],
    nextActivityAt: lead.nextActivityAt ?? null,
    stageEnteredAt: lead.stageEnteredAt ?? fallback.stageEnteredAt,
  };
}
