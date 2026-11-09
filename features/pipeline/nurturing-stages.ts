/** Nurturing Pipeline stage name helpers (Clients → File Delivered → Outcome). */

export function isClientsStage(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "clients";
}

export function isFileDeliveredStage(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n === "file delivered" || n === "documents sent";
}

export function isOutcomeStage(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "outcome";
}
