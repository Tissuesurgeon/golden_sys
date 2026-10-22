import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { applicationFormAction } from "@/lib/server/forms";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export default async function NewApplicationPage() {
  const user = await requireUser();
  if (!can(user.role, "admissions.manage")) redirect("/dashboard");
  const classes = await prisma.classRoom.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="New application"
        description="Save a draft to finish later, or submit it for a decision."
        actions={<Link href="/admissions" className="text-sm font-medium text-blue">Back to admissions</Link>}
      />
      <Surface className="p-5">
        <form action={applicationFormAction} className="grid gap-6">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-base font-semibold text-navy">Applicant</legend>
            <Field label="First name"><input name="firstName" required className={inputClass} /></Field>
            <Field label="Last name"><input name="lastName" required className={inputClass} /></Field>
            <Field label="Other names"><input name="otherNames" className={inputClass} /></Field>
            <Field label="Sex">
              <select name="sex" className={selectClassName()}><option>Female</option><option>Male</option></select>
            </Field>
            <Field label="Date of birth"><input name="dateOfBirth" type="date" required className={inputClass} /></Field>
            <Field label="Intended class">
              <select name="classId" className={selectClassName()} required>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <Field label="Address" className="sm:col-span-2"><input name="address" className={inputClass} /></Field>
          </fieldset>
          <fieldset className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
            <legend className="mb-1 text-base font-semibold text-navy">Parent or guardian</legend>
            <Field label="Name"><input name="guardianName" className={inputClass} /></Field>
            <Field label="Relationship"><input name="relationship" placeholder="Mother, father, guardian" className={inputClass} /></Field>
            <Field label="Phone"><input name="phone" className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button name="intent" value="draft" className="h-11 rounded-lg border border-border px-4 text-sm font-medium">Save draft</button>
            <button name="intent" value="submit" className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-white">Submit application</button>
          </div>
        </form>
      </Surface>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5 text-sm", className)}>
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
