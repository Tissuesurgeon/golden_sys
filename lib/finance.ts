const CLOSED = new Set(["cancelled", "reversed", "carried_forward"]);

export type BalanceInvoice = {
  status: string;
  items: { amount: number; label?: string; feeItemId?: string | null }[];
  adjustments: { amount: number; reversedAt: Date | null }[];
  allocations: { amount: number; payment: { reversedAt: Date | null } }[];
};

export function invoiceBalance(invoice: BalanceInvoice) {
  if (CLOSED.has(invoice.status)) return { charges: 0, adjustments: 0, paid: 0, balance: 0, open: false };
  const charges = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const adjustments = invoice.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0);
  const paid = invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0);
  return { charges, adjustments, paid, balance: charges + adjustments - paid, open: true };
}

export function isOverdue(invoice: { status: string; dueOn: Date | null }, balance: number, today = new Date()) {
  if (balance <= 0) return false;
  if (invoice.status !== "issued" && invoice.status !== "partial" && invoice.status !== "overdue") return false;
  if (!invoice.dueOn) return false;
  return invoice.dueOn.getTime() < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

export function displayInvoiceStatus(invoice: { status: string; dueOn: Date | null }, balance: number, today = new Date()) {
  if (isOverdue(invoice, balance, today)) return "overdue";
  return invoice.status;
}
