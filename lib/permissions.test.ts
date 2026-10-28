import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("permission scoping", () => {
  it("keeps teachers out of finance and publishing", () => {
    expect(can("teacher", "finance.read")).toBe(false);
    expect(can("teacher", "finance.write")).toBe(false);
    expect(can("teacher", "academics.read")).toBe(true);
    expect(can("teacher", "academics.publish")).toBe(false);
    expect(can("teacher", "students.write")).toBe(false);
  });

  it("lets the bursar handle fees and keeps academics with the office", () => {
    expect(can("bursar", "finance.read")).toBe(true);
    expect(can("bursar", "academics.read")).toBe(false);
    expect(can("bursar", "academics.approve")).toBe(false);
    expect(can("administrator", "settings.manage")).toBe(true);
    expect(can("bursar", "settings.manage")).toBe(false);
  });
});
