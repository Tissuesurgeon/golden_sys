import { describe, expect, it } from "vitest";
import { invoiceBalance } from "@/lib/finance";
import { applicableFees, splitInvoiceRun, studentAudience, termInvoiceLines, type TermSpan } from "@/lib/invoices";
import { assertCan, can } from "@/lib/permissions";

describe("term invoices", () => {
  it("adds arrears once and skips students who already have the term invoice", () => {
    const lines = termInvoiceLines(
      [
        { id: "fee-1", name: "Tuition", amount: 40000 },
        { id: "fee-2", name: "Empty", amount: 0 },
      ],
      15000,
    );
    expect(lines.map((line) => line.label)).toEqual(["Tuition", "Arrears brought forward"]);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(55000);
    const run = splitInvoiceRun(["a", "b", "c"], new Set(["b"]));
    expect(run.create).toEqual(["a", "c"]);
    expect(run.skipped).toEqual(["b"]);
  });

  it("drops carried-forward invoices from the open balance", () => {
    const open = invoiceBalance({
      status: "issued",
      items: [{ amount: 1000 }],
      adjustments: [],
      allocations: [{ amount: 200, payment: { reversedAt: null } }],
    });
    const carried = invoiceBalance({
      status: "carried_forward",
      items: [{ amount: 1000 }],
      adjustments: [],
      allocations: [],
    });
    expect(open.balance).toBe(800);
    expect(carried.balance).toBe(0);
  });

  it("charges new students the new and shared fees, and returning students the returning and shared fees", () => {
    const fees = [
      { id: "tuition", name: "Tuition", amount: 85000, appliesTo: "all" as const },
      { id: "uniform", name: "Uniform", amount: 12000, appliesTo: "new" as const },
      { id: "bus", name: "Bus", amount: 5000, appliesTo: "returning" as const },
    ];
    expect(applicableFees(fees, "new").map((fee) => fee.name)).toEqual(["Tuition", "Uniform"]);
    expect(applicableFees(fees, "returning").map((fee) => fee.name)).toEqual(["Tuition", "Bus"]);
    const term1: TermSpan = { id: "t1", startsOn: new Date("2026-09-01T00:00:00.000Z"), endsOn: new Date("2026-12-18T00:00:00.000Z") };
    const term2: TermSpan = { id: "t2", startsOn: new Date("2027-01-08T00:00:00.000Z"), endsOn: new Date("2027-04-10T00:00:00.000Z") };
    const terms = [term1, term2];
    expect(studentAudience(new Date("2026-10-28T00:00:00.000Z"), term1, terms)).toBe("new");
    expect(studentAudience(new Date("2026-10-28T00:00:00.000Z"), term2, terms)).toBe("returning");
    expect(studentAudience(new Date("2027-02-01T00:00:00.000Z"), term1, terms)).toBe("not_enrolled");
    expect(studentAudience(new Date("2027-02-01T00:00:00.000Z"), term2, terms)).toBe("new");
    expect(studentAudience(null, term1, terms)).toBe("returning");
  });

  it("lets the administrator and bursar generate one student's invoice and refuses a teacher", () => {
    expect(can("administrator", "invoices.generate")).toBe(true);
    expect(can("bursar", "invoices.generate")).toBe(true);
    expect(can("teacher", "invoices.generate")).toBe(false);
    expect(() => assertCan("administrator", "invoices.generate")).not.toThrow();
    expect(() => assertCan("bursar", "invoices.generate")).not.toThrow();
    expect(() => assertCan("teacher", "invoices.generate")).toThrow(/permission/);
  });
});
