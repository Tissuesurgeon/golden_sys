import type { EnrollmentPolicy } from "@prisma/client";

export function enrollmentAllowed(input: {
  policy: EnrollmentPolicy;
  total: number;
  paid: number;
  adjustments: number;
  minimumDeposit: number;
}) {
  const due = input.total + input.adjustments - input.paid;
  if (input.policy === "waiver_only") return input.adjustments < 0 && due <= 0;
  if (input.policy === "minimum_deposit") return due <= 0 || input.paid >= input.minimumDeposit;
  return due <= 0;
}
