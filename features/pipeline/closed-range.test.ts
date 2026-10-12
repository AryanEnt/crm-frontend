import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closedColumns, closedInterval, nextIsoDate, type Interval } from "./closed-range.ts";

const DAY = 86_400_000;
// Monday 5 October 2026, 10:00 in Sydney.
const now = Date.parse("2026-10-04T23:00:00.000Z");
const sydney = "Australia/Sydney";
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const f = (closed: string, closedFrom = "", closedTo = "") => ({ closed, closedFrom, closedTo }) as Parameters<typeof closedInterval>[0];

describe("closed date filter", () => {
  it("counts quick ranges back from now", () => {
    assert.deepEqual(closedInterval(f(""), now), { from: null, to: null });
    assert.deepEqual(closedInterval(f("7d"), now), { from: now - 7 * DAY, to: null });
    assert.deepEqual(closedInterval(f("90d"), now), { from: now - 90 * DAY, to: null });
  });

  it("starts this year at midnight on 1 January where the user is", () => {
    assert.equal(iso(closedInterval(f("year"), now, sydney).from), "2025-12-31T13:00:00.000Z");
  });

  it("includes the whole of both custom dates", () => {
    const i = closedInterval(f("custom", "2026-10-01", "2026-10-05"), now, sydney);
    assert.equal(iso(i.from), "2026-09-30T14:00:00.000Z");
    // Sydney moved to daylight time on 4 October, so midnight is 13:00 UTC by the 6th.
    assert.equal(iso(i.to), "2026-10-05T13:00:00.000Z");
    assert.deepEqual(closedInterval(f("custom", "", "2026-10-05"), now, sydney).from, null);
  });

  it("rolls dates over month and year ends", () => {
    assert.equal(nextIsoDate("2026-10-31"), "2026-11-01");
    assert.equal(nextIsoDate("2026-12-31"), "2027-01-01");
  });
});

describe("closed kanban columns", () => {
  const all: Interval = { from: null, to: null };

  it("groups by how long ago the lead closed, newest first", () => {
    const cols = closedColumns(all, now);
    assert.deepEqual(cols.map((c) => c.label), ["Past 7 days", "8–30 days ago", "1–3 months ago", "Over 3 months ago"]);
    assert.deepEqual(cols[0]!.interval, { from: now - 7 * DAY, to: null });
    assert.deepEqual(cols[1]!.interval, { from: now - 30 * DAY, to: now - 7 * DAY });
    assert.deepEqual(cols[3]!.interval, { from: null, to: now - 90 * DAY });
  });

  it("drops columns outside the date filter and narrows the rest to it", () => {
    const cols = closedColumns({ from: now - 30 * DAY, to: null }, now);
    assert.deepEqual(cols.map((c) => c.id), ["week", "month"]);
    const custom = closedColumns({ from: now - 45 * DAY, to: now - 20 * DAY }, now);
    assert.deepEqual(custom.map((c) => c.id), ["month", "quarter"]);
    assert.deepEqual(custom[0]!.interval, { from: now - 30 * DAY, to: now - 20 * DAY });
    assert.deepEqual(custom[1]!.interval, { from: now - 45 * DAY, to: now - 30 * DAY });
  });
});
