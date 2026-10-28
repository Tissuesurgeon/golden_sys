import { describe, expect, it } from "vitest";
import { attendanceTotals, ranksWithTies, showsPosition } from "@/lib/academics";

describe("class positions", () => {
  it("shares a rank and skips the next number", () => {
    const ranks = ranksWithTies([
      { id: "a", total: 90 },
      { id: "b", total: 80 },
      { id: "c", total: 80 },
      { id: "d", total: 70 },
    ]);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(2);
    expect(ranks.get("c")).toBe(2);
    expect(ranks.get("d")).toBe(4);
  });

  it("hides positions for KG", () => {
    expect(showsPosition("KG")).toBe(false);
    expect(showsPosition("Primary")).toBe(true);
    expect(showsPosition("JHS")).toBe(true);
  });
});

describe("attendance totals", () => {
  it("counts each status and keeps days open separate", () => {
    expect(
      attendanceTotals(
        [{ status: "present" }, { status: "present" }, { status: "absent" }, { status: "late" }, { status: "excused" }],
        6,
      ),
    ).toEqual({ present: 2, absent: 1, late: 1, excused: 1, daysOpen: 6 });
  });
});
