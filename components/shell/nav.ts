import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings,
  Shield,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { Role } from "@/lib/prototype/types";

const everyone: Role[] = ["administrator", "bursar", "teacher"];

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: everyone },
  { href: "/admissions", label: "Admissions", icon: ClipboardList, roles: ["administrator", "bursar"] as Role[] },
  { href: "/students", label: "Students", icon: Users, roles: everyone },
  { href: "/guardians", label: "Parents and Guardians", icon: Users, roles: ["administrator", "bursar"] as Role[] },
  { href: "/fees", label: "Fees and Finance", icon: Wallet, roles: ["administrator", "bursar"] as Role[] },
  { href: "/fees/bills", label: "Fee bills", icon: FileText, roles: ["administrator", "bursar"] as Role[] },
  { href: "/fees/invoices", label: "Invoices", icon: FileText, roles: ["administrator", "bursar"] as Role[] },
  { href: "/finance", label: "Finance report", icon: ScrollText, roles: ["administrator", "bursar"] as Role[] },
  { href: "/academics", label: "Academics", icon: BookOpen, roles: ["administrator", "teacher"] as Role[] },
  { href: "/report-cards", label: "Report Cards", icon: FileText, roles: ["administrator", "teacher"] as Role[] },
  { href: "/classes", label: "Classes and Subjects", icon: Library, roles: ["administrator", "teacher"] as Role[] },
  { href: "/staff", label: "Teachers and Staff", icon: GraduationCap, roles: ["administrator"] as Role[] },
  { href: "/reports", label: "Reports", icon: ScrollText, roles: everyone },
  { href: "/audit", label: "Audit Log", icon: Shield, roles: ["administrator"] as Role[] },
  { href: "/users", label: "Users and Permissions", icon: Shield, roles: ["administrator"] as Role[] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["administrator"] as Role[] },
  { href: "/account", label: "My Account", icon: UserRound, roles: everyone },
];

export const TEACHER_NAV = [
  { href: "/my", label: "My Classes", icon: BookOpen, roles: ["teacher"] as Role[] },
  { href: "/academics/marks", label: "Marks", icon: ClipboardList, roles: ["teacher"] as Role[] },
  { href: "/attendance", label: "Attendance", icon: ClipboardList, roles: ["teacher"] as Role[] },
  { href: "/report-cards", label: "Report Cards", icon: FileText, roles: ["teacher"] as Role[] },
  { href: "/account", label: "My Account", icon: UserRound, roles: ["teacher"] as Role[] },
];
