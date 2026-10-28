import { describe, expect, it } from "vitest";
import { allocationError, invoiceDue } from "@/lib/money";

describe("payment allocations", () => {
  it("rejects a zero or negative allocation", () => {
    expect(allocationError(1000, [{ amount: 0, remaining: 1000 }])).toMatch(/greater than zero/);
    expect(allocationError(1000, [{ amount: -1, remaining: 1000 }])).toMatch(/greater than zero/);
  });

  it("rejects an allocation larger than the invoice balance", () => {
    expect(allocationError(5000, [{ amount: 3000, remaining: 2000 }])).toMatch(/invoice balance/);
  });

  it("rejects allocations that add up to more than the payment", () => {
    expect(
      allocationError(1000, [
        { amount: 600, remaining: 600 },
        { amount: 500, remaining: 500 },
      ]),
    ).toMatch(/cannot exceed the payment/);
  });

  it("accepts allocations that fit the payment and the open balance", () => {
    expect(allocationError(1000, [{ amount: 400, remaining: 700 }])).toBeNull();
    expect(invoiceDue({ charges: 1000, adjustments: -100, paid: 400 })).toBe(500);
  });
});
