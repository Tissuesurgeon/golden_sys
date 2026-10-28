"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { NAV, TEACHER_NAV } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import type { Role } from "@/lib/prototype/types";
import { roleLabel } from "@/lib/prototype/permissions";
import { signOutAction } from "@/lib/server/actions";
import { cn } from "@/lib/utils";

type ShellUser = { name: string; role: Role };
type ShellSchool = { name: string; town: string };

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Main">
      {(role === "teacher" ? TEACHER_NAV : NAV.filter((item) => item.roles.includes(role))).map((item) => {
        const items = role === "teacher" ? TEACHER_NAV : NAV;
        const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const longer = items.some((other) => other.href.length > item.href.length && (pathname === other.href || pathname.startsWith(`${other.href}/`)));
        const active = matches && !longer;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-blue-pale text-blue" : "text-ink hover:bg-muted",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandBlock({ school }: { school: ShellSchool }) {
  return (
    <div className="px-4 pt-4 pb-3">
      <SchoolLogo size={72} />
      <p className="mt-2 text-sm font-semibold leading-5 text-navy">{school.name}</p>
      <p className="text-xs text-muted-foreground">{school.town}</p>
      <div className="mt-3 h-px w-10 bg-gold" />
    </div>
  );
}

function AccountBlock({ user }: { user: ShellUser }) {
  return (
    <div className="mt-auto border-t border-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{roleLabel(user.role)}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => signOutAction()}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarBody({ user, school, onNavigate }: { user: ShellUser; school: ShellSchool; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <BrandBlock school={school} />
      <NavLinks role={user.role} onNavigate={onNavigate} />
      <AccountBlock user={user} />
    </div>
  );
}

export function AppShell({ user, school, children }: { user: ShellUser; school: ShellSchool; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const crumb = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "School";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-[230px] border-r border-border bg-white lg:block">
        <SidebarBody user={user} school={school} />
      </aside>
      <div className="min-w-0 lg:pl-[230px]">
        <header className="no-print sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu />
              </Button>
              <SheetContent side="left" className="w-[230px] p-0 sm:max-w-[230px]">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarBody user={user} school={school} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <p className="min-w-0 truncate text-sm font-medium text-navy">{crumb}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-10 place-items-center rounded-full bg-navy text-xs font-semibold text-white" aria-label="Account menu">
              <UserRound className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                <DropdownMenuItem disabled>{roleLabel(user.role)}</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-w-0 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
