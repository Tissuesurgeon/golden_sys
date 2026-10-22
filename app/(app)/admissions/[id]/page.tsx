import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LinkButton, PageHeader, StatusBadge, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { isoDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { enrollmentAllowed } from "@/lib/enrollment";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { admissionPaymentAction, decisionAction, enrollAction, invoiceAction, uploadAction, waiveAction } from "@/lib/server/forms";
import { cn } from "@/lib/utils";

const methodLabel: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank transfer",
  other: "Other",
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "admissions.manage") && !can(user.role, "admissions.pay")) redirect("/dashboard");
  const { id } = await params;
  const { error } = await searchParams;
  const application = await prisma.admissionApplication.findUnique({
    where: { id },
    include: {
      intendedClass: true,
      guardians: true,
      decisions: { orderBy: { createdAt: "desc" } },
      invoices: { include: { items: true, allocations: { include: { payment: true } }, adjustments: true } },
      payments: { orderBy: { createdAt: "desc" } },
      student: true,
    },
  });
  if (!application) notFound();
  const [documents, settings] = await Promise.all([
    prisma.document.findMany({ where: { ownerType: "application", ownerId: id }, orderBy: { createdAt: "desc" } }),
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
  ]);
  const invoice = application.invoices.find((item) => item.status !== "cancelled" && item.status !== "reversed");
  const total = invoice?.items.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const paid = invoice?.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const adjustments = invoice?.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const due = total + adjustments - paid;
  const policy = settings?.enrollmentPolicy ?? "full_or_waiver";
  const gateOpen = invoice
    ? enrollmentAllowed({ policy, total, paid, adjustments, minimumDeposit: settings?.minimumDeposit ?? 0 })
    : false;
  const canManage = can(user.role, "admissions.manage");
  const enrolled = Boolean(application.student);
  const enrollment = enrolled
    ? {
        tone: "success" as const,
        badge: "Enrolled",
        title: `Enrolled as ${application.student?.admissionNumber}`,
        body: application.student?.enrolledOn
          ? `The student record was created on ${formatDate(isoDate(application.student.enrolledOn))}. Class, guardians, and this fee history stay attached to it.`
          : "The student record holds the class, guardians, and this fee history.",
      }
    : application.status !== "accepted"
      ? {
          tone: "neutral" as const,
          badge: "Waiting",
          title: "Acceptance comes first",
          body: "Record an acceptance on this application. Enrollment opens after that decision.",
        }
      : !invoice
        ? {
            tone: "warning" as const,
            badge: "Invoice needed",
            title: "Issue the admission invoice",
            body: "The invoice has to exist before the fee gate can be checked. Enrollment is the step after that gate.",
          }
        : gateOpen
          ? {
              tone: "success" as const,
              badge: "Ready",
              title: "Ready to enroll",
              body:
                policy === "minimum_deposit" && due > 0
                  ? `The ${formatMoney(settings?.minimumDeposit ?? 0)} deposit is recorded. ${formatMoney(due)} stays open on the invoice and follows the student.`
                  : "The admission fee is settled. Enrolling creates the student, admission number, and class place.",
            }
          : policy === "waiver_only"
            ? {
                tone: "warning" as const,
                badge: "Waiver needed",
                title: "A waiver clears enrollment",
                body: `${formatMoney(Math.max(due, 0))} is still open. Waive that balance, then enroll.`,
              }
            : policy === "minimum_deposit"
              ? {
                  tone: "warning" as const,
                  badge: "Deposit short",
                  title: "The deposit is still short",
                  body: `${formatMoney(paid)} is recorded toward the ${formatMoney(settings?.minimumDeposit ?? 0)} deposit.`,
                }
              : {
                  tone: "warning" as const,
                  badge: "Fee open",
                  title: "The admission fee is still open",
                  body: `${formatMoney(Math.max(due, 0))} remains. Record the rest, or waive the balance, then enroll.`,
                };

  return (
    <div className="space-y-4">
      <PageHeader title={`${application.firstName} ${application.lastName}`} description={`${application.number} · ${application.intendedClass.name} · ${application.status.replaceAll("_", " ")}`} />
      {error ? <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="space-y-2 p-5 text-sm">
          <h2 className="text-lg font-semibold text-navy">Applicant</h2>
          <p>{application.sex} · {isoDate(application.dateOfBirth)}</p>
          <p>{application.address || "No address recorded"}</p>
          {application.guardians.map((guardian) => (
            <p key={guardian.id}>{guardian.fullName} · {guardian.relationship} · {guardian.phone}</p>
          ))}
          {application.student ? <Link className="text-blue" href={`/students/${application.student.id}`}>Open student record</Link> : null}
        </Surface>
        <Surface className="space-y-3 p-5">
          <h2 className="text-lg font-semibold text-navy">Decision</h2>
          {application.decisions[0] ? <p className="text-sm text-muted-foreground">{application.decisions[0].outcome}: {application.decisions[0].reason}</p> : null}
          {application.status !== "enrolled" && application.status !== "draft" ? (
            <form action={decisionAction} className="grid gap-2">
              <input type="hidden" name="id" value={application.id} />
              <select name="outcome" className={selectClassName()}>
                <option value="under_review">Under review</option>
                <option value="accepted">Accepted</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="deferred">Deferred</option>
                <option value="rejected">Rejected</option>
              </select>
              <input name="reason" required placeholder="Reason" className="h-11 rounded-lg border border-input px-3 text-sm" />
              <button className="h-11 rounded-lg bg-primary text-sm font-medium text-white">Record decision</button>
            </form>
          ) : null}
          {application.status === "draft" ? <p className="text-sm text-muted-foreground">Submit the draft before a decision can be recorded.</p> : null}
        </Surface>
        <Surface className="space-y-3 p-5">
          <h2 className="text-lg font-semibold text-navy">Admission invoice</h2>
          {invoice ? (
            <div className="text-sm">
              <p>{invoice.number} · {invoice.status}</p>
              <ul className="mt-2 space-y-1">{invoice.items.map((item) => <li key={item.id} className="flex justify-between"><span>{item.label}</span><span>{formatMoney(item.amount)}</span></li>)}</ul>
              <p className="mt-2 font-medium">Received {formatMoney(paid)} of {formatMoney(total)}</p>
              {due > 0 ? <p className="text-muted-foreground">Still open {formatMoney(due)}</p> : <p className="text-success">Nothing left on this invoice.</p>}
              <Link className="mt-2 inline-block text-blue" href={`/api/pdf/invoice/${invoice.id}`}>Download invoice PDF</Link>
              {application.payments.length > 0 ? (
                <ul className="mt-3 divide-y divide-border border-t border-border">
                  {application.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{payment.receiptNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(isoDate(payment.paidOn))} · {methodLabel[payment.method] ?? payment.method}
                          {payment.reversedAt ? " · Reversed" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums">{formatMoney(payment.amount)}</p>
                        <Link className="text-blue" href={`/api/pdf/receipt/${payment.id}`}>Receipt PDF</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <form action={invoiceAction}>
              <input type="hidden" name="id" value={application.id} />
              <button className="h-11 rounded-lg border border-border px-4 text-sm font-medium">Issue admission invoice</button>
            </form>
          )}
          {invoice && application.status !== "enrolled" ? (
            <form action={admissionPaymentAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={application.id} />
              <input name="amount" inputMode="decimal" required placeholder="Amount (GHS)" className="h-11 rounded-lg border border-input px-3 text-sm" />
              <input name="date" type="date" required defaultValue={isoDate(new Date())} className="h-11 rounded-lg border border-input px-3 text-sm" />
              <select name="method" className={selectClassName()}>
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
              <input name="reference" placeholder="Reference" className="h-11 rounded-lg border border-input px-3 text-sm" />
              <p className="text-xs text-muted-foreground sm:col-span-2">Recorded by the school. This is not a gateway verification.</p>
              <button className="h-11 rounded-lg bg-primary text-sm font-medium text-white sm:col-span-2">Record payment</button>
            </form>
          ) : null}
          {invoice && due > 0 && application.status !== "enrolled" && canManage ? (
            <form action={waiveAction} className="flex gap-2">
              <input type="hidden" name="id" value={application.id} />
              <input name="reason" required placeholder="Waiver reason" className="h-11 min-w-0 flex-1 rounded-lg border border-input px-3 text-sm" />
              <button className="h-11 rounded-lg border border-border px-3 text-sm">Waive balance</button>
            </form>
          ) : null}
        </Surface>
        <Surface className="p-5">
          <h2 className="text-lg font-semibold text-navy">Documents</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Birth certificates, reports, and other files stay with this application. Each file can be up to 8 MB.</p>
          {canManage ? (
            <form action={uploadAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="hidden" name="id" value={application.id} />
              <input
                name="file"
                type="file"
                required
                aria-label="Document file"
                className="block h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-ink"
              />
              <Button type="submit" variant="outline" className="shrink-0">Upload</Button>
            </form>
          ) : null}
          {documents.length === 0 ? (
            <p className="mt-3 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link className="block truncate text-sm font-medium text-blue" href={`/api/documents/${document.id}`}>{document.filename}</Link>
                    <p className="text-xs text-muted-foreground">{fileSize(document.size)} · {formatDate(isoDate(document.createdAt))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-navy">Enrollment</h2>
              <StatusBadge tone={enrollment.tone === "neutral" ? "neutral" : enrollment.tone}>{enrollment.badge}</StatusBadge>
            </div>
            <div
              className={cn(
                "mt-3 rounded-xl px-4 py-3",
                enrollment.tone === "success" && "bg-success-bg",
                enrollment.tone === "warning" && "bg-warning-bg",
                enrollment.tone === "neutral" && "bg-muted",
              )}
            >
              <p className="text-sm font-medium text-ink">{enrollment.title}</p>
              <p className="mt-1 text-sm leading-6 text-ink">{enrollment.body}</p>
            </div>
            {canManage && application.status === "accepted" && gateOpen && !enrolled ? (
              <form action={enrollAction} className="mt-3">
                <input type="hidden" name="id" value={application.id} />
                <Button type="submit">Enroll student</Button>
              </form>
            ) : null}
            {application.student ? (
              <LinkButton href={`/students/${application.student.id}`} variant="outline" className="mt-3">
                Open student record
              </LinkButton>
            ) : null}
          </div>
        </Surface>
      </div>
    </div>
  );
}
