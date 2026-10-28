import type { Role } from "@prisma/client";

const MATRIX: Record<string, Role[]> = {
  "finance.read": ["administrator", "bursar"],
  "finance.write": ["administrator", "bursar"],
  "invoices.generate": ["administrator", "bursar"],
  "academics.read": ["administrator", "teacher"],
  "academics.write": ["administrator", "teacher"],
  "academics.approve": ["administrator"],
  "academics.publish": ["administrator"],
  "staff.manage": ["administrator"],
  "settings.manage": ["administrator"],
  "admissions.manage": ["administrator"],
  "admissions.pay": ["administrator", "bursar"],
  "students.read": ["administrator", "bursar", "teacher"],
  "students.write": ["administrator"],
  "reports.finance": ["administrator", "bursar"],
  "reports.academic": ["administrator", "teacher"],
  "audit.read": ["administrator"],
  "users.manage": ["administrator"],
};

export function can(role: Role, permission: keyof typeof MATRIX | string) {
  return (MATRIX[permission] ?? []).includes(role);
}

export function assertCan(role: Role, permission: string) {
  if (!can(role, permission)) {
    const error = new Error("You do not have permission for that action.");
    error.name = "ForbiddenError";
    throw error;
  }
}
