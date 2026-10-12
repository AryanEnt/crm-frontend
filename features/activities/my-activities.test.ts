import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Activity } from "@/lib/api/crm";
import { groupMyActivities } from "./my-activities.ts";

const act = (id: string, day: string, extra: Partial<Activity> = {}) =>
  ({ id, status: "upcoming", displayStatus: "upcoming", dueAt: `${day}T09:00:00Z`, ...extra }) as Activity;

const dayOf = (a: Activity) => (a.dueAt ?? "").slice(0, 10);
const ids = (list: Activity[]) => list.map((a) => a.id);

describe("groupMyActivities", () => {
  it("splits open work into overdue, today and later days", () => {
    const g = groupMyActivities(
      [act("late", "2026-10-01", { displayStatus: "overdue" })],
      [act("today", "2026-10-05"), act("later", "2026-10-08")],
      dayOf,
      "2026-10-05",
    );
    assert.deepEqual(ids(g.overdue), ["late"]);
    assert.deepEqual(ids(g.today), ["today"]);
    assert.deepEqual(ids(g.upcoming), ["later"]);
  });

  it("never lists an activity twice and moves overdue scheduled items to overdue", () => {
    const late = act("late", "2026-10-05", { displayStatus: "overdue" });
    const g = groupMyActivities([late], [late, act("missed", "2026-10-05", { displayStatus: "overdue" })], dayOf, "2026-10-05");
    assert.deepEqual(ids(g.overdue).sort(), ["late", "missed"]);
    assert.equal(g.today.length, 0);
  });

  it("drops completed, cancelled and just-completed activities", () => {
    const g = groupMyActivities(
      [],
      [
        act("done", "2026-10-05", { status: "completed" }),
        act("off", "2026-10-05", { status: "cancelled" }),
        act("ticked", "2026-10-05"),
        act("open", "2026-10-05"),
      ],
      dayOf,
      "2026-10-05",
      new Set(["ticked"]),
    );
    assert.deepEqual(ids(g.today), ["open"]);
  });

  it("shows the most recently missed overdue item first", () => {
    const g = groupMyActivities(
      [act("old", "2026-09-20", { displayStatus: "overdue" }), act("recent", "2026-10-04", { displayStatus: "overdue" })],
      [],
      dayOf,
      "2026-10-05",
    );
    assert.deepEqual(ids(g.overdue), ["recent", "old"]);
  });
});
