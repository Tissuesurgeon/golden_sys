import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LinkButton({
  href,
  variant = "default",
  className,
  children,
}: {
  href: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant }), className)}>
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-tight break-words text-navy sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Surface({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_46_99/0.04)]", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-muted text-ink",
  info: "bg-blue-pale text-blue",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  navy: "bg-navy text-white",
} as const;

export function StatusBadge({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function studentStatusTone(status: string): keyof typeof tones {
  if (status === "enrolled") return "success";
  if (status === "pending") return "info";
  if (status === "withdrawn" || status === "transferred") return "warning";
  if (status === "graduated") return "navy";
  return "neutral";
}

export function sheetStatusTone(status: string): keyof typeof tones {
  if (status === "published") return "navy";
  if (status === "approved") return "success";
  if (status === "submitted") return "info";
  if (status === "returned") return "danger";
  return "neutral";
}

export function sheetStatusLabel(status: string) {
  if (status === "draft") return "Draft";
  if (status === "submitted") return "Awaiting review";
  if (status === "returned") return "Returned";
  if (status === "approved") return "Approved";
  if (status === "published") return "Published";
  return status;
}

export function balanceTone(amount: number): keyof typeof tones {
  if (amount <= 0) return "success";
  return "danger";
}

export function balanceLabel(amount: number) {
  if (amount < 0) return "Credit";
  if (amount === 0) return "Paid";
  return "Outstanding";
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="px-6 py-14 text-center" role="alert">
      <h2 className="text-base font-semibold text-navy">The student list could not be loaded</h2>
      <p className="mt-1 text-sm text-muted-foreground">Check the connection and try again. No records were changed.</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-hover"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function SampleNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-gold-pale px-4 py-3">
      <StatusBadge tone="warning">Sample</StatusBadge>
      <p className="min-w-0 text-sm leading-6 text-ink">{children}</p>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPage,
  from,
  to,
  total,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  from: number;
  to: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {total === 0 ? 0 : from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-ink hover:bg-muted disabled:opacity-40"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {Math.max(pageCount, 1)}
        </span>
        <button
          type="button"
          className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-ink hover:bg-muted disabled:opacity-40"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-blue hover:text-blue-hover">
      {children}
    </Link>
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function selectClassName(invalid = false) {
  return cn(
    "h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
    invalid ? "border-danger" : "border-input",
  );
}
