"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Menu,
  Search,
  UserRound,
} from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { StatusBadge } from "@/components/common/ui-bits";
import { NAV } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/prototype/permissions";
import { className, currentStaff, studentName } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { Role } from "@/lib/prototype/types";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { state } = usePrototype();
  const staff = currentStaff(state);
  const role = staff?.role ?? "teacher";

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Main">
      {NAV.filter((item) => item.roles.includes(role)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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

function BrandBlock() {
  const { state } = usePrototype();
  return (
    <div className="px-4 pt-4 pb-3">
      <SchoolLogo size={72} />
      <p className="mt-2 text-sm font-semibold leading-5 text-navy">{state.school.name}</p>
      <p className="text-xs text-muted-foreground">{state.school.town}</p>
      <div className="mt-3 h-px w-10 bg-gold" />
    </div>
  );
}

function AccountBlock() {
  const { state, dispatch } = usePrototype();
  const router = useRouter();
  const staff = currentStaff(state);
  if (!staff) return null;

  function switchRole(role: Role) {
    const next = state.staff.find((member) => member.role === role && member.status === "active");
    if (next) dispatch({ type: "sign-in", staffId: next.id });
  }

  return (
    <div className="mt-auto border-t border-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-white">
            {initials(staff.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{staff.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{roleLabel(staff.role)}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Preview as</DropdownMenuLabel>
            {(["administrator", "bursar", "teacher"] as Role[]).map((role) => (
              <DropdownMenuItem key={role} onClick={() => switchRole(role)}>
                {roleLabel(role)}
                {staff.role === role ? " · current" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              dispatch({ type: "sign-out" });
              router.push("/login");
            }}
          >
            <LogOut className="size-4" />
            Sign out of preview
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <BrandBlock />
      <NavLinks onNavigate={onNavigate} />
      <AccountBlock />
    </div>
  );
}

function HeaderSearch() {
  const { state } = usePrototype();
  const router = useRouter();
  const staff = currentStaff(state);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return state.students
      .filter((student) => {
        const haystack = `${studentName(student)} ${student.admissionNumber}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 6);
  }, [query, state.students]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search students"
        aria-label="Search Golden Child School records"
        className="pl-9"
      />
      {open && query.trim().length >= 2 ? (
        <div className="absolute top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No matching student in this school.</p>
          ) : (
            <ul>
              {results.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-blue-pale"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(`/students/${student.id}`);
                    }}
                  >
                    <span>
                      <span className="block font-medium text-ink">{studentName(student)}</span>
                      <span className="text-xs text-muted-foreground">
                        {student.admissionNumber} · {className(state, student.classId)}
                      </span>
                    </span>
                    {staff?.role === "teacher" ? null : <StatusBadge tone="neutral">Record</StatusBadge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, ready } = usePrototype();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const staff = currentStaff(state);

  useEffect(() => {
    if (ready && !state.sessionStaffId) router.replace("/login");
  }, [ready, state.sessionStaffId, router]);

  if (!ready || !staff) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-center">
          <SchoolLogo size={84} />
          <p className="mt-3 text-sm text-muted-foreground">Opening Golden Child School…</p>
        </div>
      </div>
    );
  }

  const crumb = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "School";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-[230px] border-r border-border bg-white lg:block">
        <SidebarBody />
      </aside>
      <div className="min-w-0 lg:pl-[230px]">
        <header className="no-print sticky top-0 z-20 flex h-16 min-w-0 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <SheetContent side="left" className="w-[230px] p-0 sm:max-w-[230px]">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <p className="hidden text-sm font-medium text-navy sm:block">{crumb}</p>
          <HeaderSearch />
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-10 place-items-center rounded-full bg-navy text-xs font-semibold text-white" aria-label="Account menu">
              <UserRound className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{staff.name}</DropdownMenuLabel>
                <DropdownMenuItem disabled>{roleLabel(staff.role)}</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-w-0 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
