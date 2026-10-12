/**
 * Runs a per-record mutation across a selection and reports how many succeeded.
 * Used by list views whose API exposes only single-record endpoints, so one
 * failing row never hides the rows that did save.
 */
export type BulkResult = { ok: number; failed: number; firstError?: string };

export async function runBulk<T>(
  items: readonly T[],
  run: (item: T) => Promise<unknown>,
): Promise<BulkResult> {
  const settled = await Promise.allSettled(items.map((item) => run(item)));
  let ok = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      ok += 1;
      continue;
    }
    failed += 1;
    if (!firstError) {
      firstError = result.reason instanceof Error ? result.reason.message : undefined;
    }
  }
  return { ok, failed, firstError };
}

/** "3 customers updated" / "2 customers updated, 1 failed" — the toast sentence. */
export function bulkMessage(result: BulkResult, noun: string, pastTenseVerb: string) {
  const counted = `${result.ok} ${result.ok === 1 ? noun : `${noun}s`}`;
  if (result.failed === 0) return `${counted} ${pastTenseVerb}`;
  if (result.ok === 0) return result.firstError ?? `Nothing was ${pastTenseVerb}`;
  return `${counted} ${pastTenseVerb}, ${result.failed} failed`;
}
