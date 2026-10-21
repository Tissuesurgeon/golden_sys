import type { Role } from "@/lib/prototype/types";

export function canViewFinance(role: Role) {
  return role === "administrator" || role === "bursar";
}

export function canManageStudents(role: Role) {
  return role === "administrator";
}

export function canRecordPayments(role: Role) {
  return role === "administrator" || role === "bursar";
}

export function canConfigureAcademics(role: Role) {
  return role === "administrator";
}

export function canEnterMarks(role: Role) {
  return role === "administrator" || role === "teacher";
}

export function canReviewResults(role: Role) {
  return role === "administrator";
}

export function canManageStaff(role: Role) {
  return role === "administrator";
}

export function canManageSettings(role: Role) {
  return role === "administrator";
}

export function roleLabel(role: Role) {
  if (role === "administrator") return "School Administrator";
  if (role === "bursar") return "Accounts / Bursar";
  return "Teacher";
}
