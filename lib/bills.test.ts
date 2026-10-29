import { describe, expect, it } from "vitest";
import { buildFeeBill, planInvoiceUpdate } from "@/lib/bills";
import { can } from "@/lib/permissions";

const term1 = { yearStartsOn: Date.parse("2026-09-01"), position: 1 };
const term2 = { yearStartsOn: Date.parse("2026-09-01"), position: 2 };

describe("fee bills", () => {
  const fees = [
    { id: "tuition", name: "Tuition", amount: 85000, appliesTo: "all" as const },
    { id: "pta", name: "PTA levy", amount: 8000, appliesTo: "new" as const },
    { id: "bus", name: "Bus", amount: 5000, appliesTo: "returning" as const },
  ];

  it("shows a fee change on the bill and on the stored invoice update", () => {
    const first = buildFeeBill({ fees, audience: "returning", prior: [], term: term2, adjustments: 0, paid: 0 });
    expect(first.lines.map((line) => line.amount)).toEqual([85000, 5000]);
    const raised = fees.map((fee) => (fee.id === "tuition" ? { ...fee, amount: 90000 } : fee));
    const next = buildFeeBill({ fees: raised, audience: "returning", prior: [], term: term2, adjustments: 0, paid: 0 });
    expect(next.due).toBe(95000);
    expect(planInvoiceUpdate(first.lines, next.lines, false)).toEqual({ action: "replace", lines: next.lines });
    expect(planInvoiceUpdate(first.lines, next.lines, true)).toEqual({
      action: "difference",
      line: { label: "Fee update", amount: 5000, feeItemId: null },
    });
  });

  it("treats a reprint of the same fees as unchanged", () => {
    const bill = buildFeeBill({ fees, audience: "new", prior: [], term: term1, adjustments: 0, paid: 0 });
    expect(planInvoiceUpdate(bill.lines, bill.lines, false).action).toBe("unchanged");
    expect(planInvoiceUpdate(bill.lines, bill.lines, true).action).toBe("unchanged");
  });

  it("carries the Term 1 balance onto the Term 2 bill without copying it into the fee lines", () => {
    const bill = buildFeeBill({
      fees,
      audience: "returning",
      prior: [
        {
          ...term1,
          status: "partial",
          items: [{ amount: 20000 }],
          adjustments: [],
          allocations: [{ amount: 5000, payment: { reversedAt: null } }],
        },
      ],
      term: term2,
      adjustments: 0,
      paid: 0,
    });
    expect(bill.balanceBroughtForward).toBe(15000);
    expect(bill.lines.some((line) => line.label.includes("Arrears"))).toBe(false);
    expect(bill.due).toBe(85000 + 5000 + 15000);
  });

  it("charges new and returning students different items", () => {
    const fresh = buildFeeBill({ fees, audience: "new", prior: [], term: term1, adjustments: 0, paid: 0 });
    const returning = buildFeeBill({ fees, audience: "returning", prior: [], term: term2, adjustments: 0, paid: 0 });
    expect(fresh.lines.map((line) => line.label)).toEqual(["Tuition", "PTA levy"]);
    expect(returning.lines.map((line) => line.label)).toEqual(["Tuition", "Bus"]);
  });

  it("refuses a teacher", () => {
    expect(can("teacher", "invoices.generate")).toBe(false);
    expect(can("bursar", "invoices.generate")).toBe(true);
    expect(can("administrator", "invoices.generate")).toBe(true);
  });
});
