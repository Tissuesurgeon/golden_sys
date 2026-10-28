export function allocationError(paymentAmount: number, allocations: { amount: number; remaining: number }[]) {
  if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) return "Enter a positive amount in pesewas.";
  let sum = 0;
  for (const allocation of allocations) {
    if (!Number.isInteger(allocation.amount) || allocation.amount <= 0) return "Each allocation must be greater than zero.";
    if (allocation.amount > allocation.remaining) return "An allocation is larger than the invoice balance.";
    sum += allocation.amount;
  }
  if (sum > paymentAmount) return "Allocations cannot exceed the payment.";
  return null;
}

export function invoiceDue(parts: { charges: number; adjustments: number; paid: number }) {
  return parts.charges + parts.adjustments - parts.paid;
}
