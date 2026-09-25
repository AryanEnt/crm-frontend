/**
 * Aurora operator voice — Phase 5.
 *
 * Rules:
 * - Name what the person understands, not the implementation.
 * - Buttons and success toasts share the same verb.
 * - Empties invite an action; errors say what failed and what to do next.
 * - Never vague ("Something went wrong") or apologetic ("Sorry…").
 */

export const copy = {
  error: {
    loadTitle: "Couldn't load this view",
    loadDescription:
      "Check your connection, then try again. If it keeps failing, ask your admin.",
    generic: "Couldn't complete that action. Check your connection and try again.",
    network: "Couldn't reach the server. Check your connection and try again.",
  },

  empty: {
    table: {
      title: "Nothing to show",
      description: "Adjust filters or create a new record.",
    },
    chart: {
      title: "No numbers for this range",
      description: "Widen the dates or clear filters to see results.",
    },
  },

  validation: {
    fixFields: "Fix the highlighted fields, then continue.",
    required: (field: string) => `Enter ${field}`,
    select: (field: string) => `Select ${field}`,
  },

  /** Success toasts — match the button verb. */
  done: {
    created: (noun: string) => `${noun} created`,
    updated: (noun: string) => `${noun} updated`,
    saved: (noun: string) => `${noun} saved`,
    deleted: (noun: string) => `${noun} deleted`,
    archived: (noun: string, count = 1) =>
      count === 1 ? `${noun} archived` : `${count} ${noun} archived`,
  },

  /**
   * Failure toasts — "Couldn't {action}." + optional fix hint.
   * Prefer a concrete action verb: "save the lead", "send email", "move the deal".
   */
  failed: (action: string, hint?: string) =>
    hint ? `Couldn't ${action}. ${hint}` : `Couldn't ${action}. Try again.`,

  filteredEmpty: (entityPlural: string) => ({
    title: `No ${entityPlural} match these filters`,
    description: `Clear filters or broaden search to find ${entityPlural}.`,
  }),
} as const;

/** Prefer API message when it is already operator-readable; else fall back. */
export function operatorErrorMessage(error: unknown, fallbackAction: string): string {
  if (error instanceof Error && error.message && !isInternalErrorCopy(error.message)) {
    return error.message;
  }
  return copy.failed(fallbackAction);
}

function isInternalErrorCopy(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m === "request failed" ||
    m.includes("internal server") ||
    m.includes("unexpected") ||
    m === "error" ||
    m.includes("status code")
  );
}
