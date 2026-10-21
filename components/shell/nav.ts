import {
  BookOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import type { Role } from "@/lib/prototype/types";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["administrator", "bursar", "teacher"] as Role[] },
  { href: "/students", label: "Students", icon: Users, roles: ["administrator", "bursar", "teacher"] as Role[] },
  { href: "/fees", label: "Fees", icon: Wallet, roles: ["administrator", "bursar"] as Role[] },
  { href: "/academics", label: "Academic Records", icon: BookOpen, roles: ["administrator", "teacher"] as Role[] },
  { href: "/report-cards", label: "Report Cards", icon: FileText, roles: ["administrator", "teacher"] as Role[] },
  { href: "/classes", label: "Classes & Subjects", icon: Library, roles: ["administrator", "teacher"] as Role[] },
  { href: "/staff", label: "Staff", icon: GraduationCap, roles: ["administrator"] as Role[] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["administrator"] as Role[] },
];
