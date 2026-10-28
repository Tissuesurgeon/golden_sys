import { describe, expect, it } from "vitest";
import { invoiceBalance } from "@/lib/finance";
import { splitInvoiceRun, termInvoiceLines } from "@/lib/invoices";

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
});
