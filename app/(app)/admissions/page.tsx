import { redirect } from "next/navigation";
import { AdmissionsDirectory, type AdmissionRow } from "@/components/admissions/admissions-directory";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "admissions.manage") && !can(user.role, "admissions.pay")) redirect("/dashboard");
  const { error } = await searchParams;
  const applications = await prisma.admissionApplication.findMany({
    include: { intendedClass: true, invoices: { include: { items: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  const rows: AdmissionRow[] = applications.map((application) => {
    const invoice = application.invoices.find((item) => item.status !== "cancelled" && item.status !== "reversed") ?? application.invoices[0];
    return {
      id: application.id,
      name: `${application.firstName} ${application.lastName}`.trim(),
      number: application.number,
      className: application.intendedClass.name,
      status: application.status,
      invoiceNumber: invoice?.number ?? null,
      invoiceTotal: invoice ? invoice.items.reduce((sum, item) => sum + item.amount, 0) : null,
      invoiceStatus: invoice?.status ?? null,
    };
  });

  return (
    <div>
      {error ? <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
      <AdmissionsDirectory rows={rows} canCreate={can(user.role, "admissions.manage")} />
    </div>
  );
}
