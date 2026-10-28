import { describe, expect, it } from "vitest";
import { invoiceBalance } from "@/lib/finance";

const payment = { reversedAt: null };

describe("invoiceBalance", () => {
  it("ignores cancelled, reversed, and carried-forward invoices", () => {
    for (const status of ["cancelled", "reversed", "carried_forward"]) {
      const result = invoiceBalance({
        status,
        items: [{ amount: 5000 }],
        adjustments: [{ amount: -100, reversedAt: null }],
        allocations: [{ amount: 2000, payment }],
      });
      expect(result.balance).toBe(0);
      expect(result.open).toBe(false);
    }
  });

  it("subtracts payments and keeps reversed payments out", () => {
    const result = invoiceBalance({
      status: "partial",
      items: [{ amount: 10000 }],
      adjustments: [
        { amount: -500, reversedAt: null },
        { amount: -200, reversedAt: new Date() },
      ],
      allocations: [
        { amount: 4000, payment },
        { amount: 1000, payment: { reversedAt: new Date() } },
      ],
    });
    expect(result).toMatchObject({ charges: 10000, adjustments: -500, paid: 4000, balance: 5500, open: true });
  });
});
