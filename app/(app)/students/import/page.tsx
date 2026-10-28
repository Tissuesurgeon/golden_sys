import { redirect } from "next/navigation";
import { PageHeader, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { importGuardiansAction, importStaffAction, importStudentsAction } from "@/lib/server/forms";

const fileClass =
  "block h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-ink";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string; tab?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "students.write")) redirect("/dashboard");
  const { error, tab } = await searchParams;
  return (
    <div>
      <PageHeader title="Import records" description="Each file is checked before anything is saved. A row with an error stops that import, and the message lists the row." />
      {error ? <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
      {tab === "staff" ? <p className="mb-4 text-sm text-muted-foreground">The staff file needs another look. The form is below.</p> : null}
      <div className="grid gap-4">
        <ImportCard
          title="Students"
          body="Creates the student and links the guardian when the phone number is new."
          columns={["admissionNumber", "firstName", "lastName", "sex", "dateOfBirth", "className", "guardianName", "guardianPhone", "relationship"]}
          action={importStudentsAction}
          button="Import students"
        />
        <ImportCard
          title="Guardians"
          body="Matches an existing guardian by phone, then links that person to the student admission number."
          columns={["fullName", "phone", "email", "studentAdmission", "relationship"]}
          action={importGuardiansAction}
          button="Import guardians"
        />
        <ImportCard
          id="staff"
          title="Staff"
          body="Imported accounts stay inactive. Issue a reset link from Users and Permissions before they can sign in."
          columns={["name", "email", "role"]}
          action={importStaffAction}
          button="Import staff"
        />
      </div>
    </div>
  );
}

function ImportCard({
  id,
  title,
  body,
  columns,
  action,
  button,
}: {
  id?: string;
  title: string;
  body: string;
  columns: string[];
  action: (formData: FormData) => Promise<void>;
  button: string;
}) {
  return (
    <Surface id={id} className="p-5">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {columns.map((column) => (
          <li key={column} className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-ink">{column}</li>
        ))}
      </ul>
      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="file" name="file" accept=".csv,text/csv" required aria-label={`${title} CSV`} className={fileClass} />
        <Button type="submit" className="shrink-0">{button}</Button>
      </form>
    </Surface>
  );
}
