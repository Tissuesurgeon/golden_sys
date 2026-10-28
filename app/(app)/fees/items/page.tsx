import { redirect } from "next/navigation";
import { PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireFinance } from "@/lib/server/guard";
import { saveDueDays, saveFeeItem } from "@/lib/server/billing";

export default async function FeeItemsPage({ searchParams }: { searchParams: Promise<{ error?: string; termId?: string; edit?: string }> }) {
  const user = await requireFinance();
  if (!can(user.role, "finance.write")) redirect("/fees");
  const query = await searchParams;
  const [settings, years, items, classes] = await Promise.all([
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
    prisma.academicYear.findMany({ include: { terms: { orderBy: { position: "asc" } } }, orderBy: { label: "desc" } }),
    prisma.feeItem.findMany({ where: { kind: "school_fee" }, include: { schedules: true }, orderBy: { name: "asc" } }),
    prisma.classRoom.findMany({ orderBy: { name: "asc" } }),
  ]);
  const terms = years.flatMap((year) => year.terms.map((term) => ({ ...term, yearLabel: year.label })));
  const termId = query.termId || settings?.currentTermId || terms[0]?.id || "";
  const editing = items.find((item) => item.id === query.edit);

  return (
    <div>
      <PageHeader title="Fee items" description="Set the catalogue amount, then override it per class for one term." />
      {query.error ? <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{query.error}</p> : null}
      {can(user.role, "settings.manage") ? (
        <Surface className="mb-4 p-5">
          <form action={saveDueDays} className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-ink">
              Days after term start before an invoice is due
              <Input className="mt-1 w-28" name="invoiceDueDays" type="number" min={0} max={120} defaultValue={settings?.invoiceDueDays ?? 14} />
            </label>
            <Button type="submit">Save due days</Button>
          </form>
        </Surface>
      ) : null}
      <Surface className="mb-4 p-5">
        <form action={saveFeeItem} className="grid gap-3">
          <input type="hidden" name="id" value={editing?.id ?? ""} />
          <input type="hidden" name="termId" value={termId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="name" required placeholder="Fee name" aria-label="Fee name" defaultValue={editing?.name ?? ""} />
            <Input name="amount" required type="number" min={0} step="0.01" placeholder="Default amount (GHS)" aria-label="Default amount" defaultValue={editing ? (editing.amount / 100).toFixed(2) : ""} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} />
              Active
            </label>
          </div>
          <div className="text-sm text-ink">
            Class amounts are for the term selected above the list. Open an item again after changing term.
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {classes.map((room) => {
              const scheduled = editing?.schedules.find((row) => row.classId === room.id && row.termId === termId);
              return (
                <label key={room.id} className="text-sm text-ink">
                  {room.name}
                  <Input className="mt-1" name={`class-${room.id}`} type="number" min={0} step="0.01" placeholder="Uses default" defaultValue={scheduled ? (scheduled.amount / 100).toFixed(2) : ""} />
                </label>
              );
            })}
          </div>
          <Button type="submit">{editing ? "Update fee item" : "Add fee item"}</Button>
        </form>
      </Surface>
      <Surface className="mb-4 p-5">
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-ink">
            Term
            <select className={`${selectClassName()} mt-1`} name="termId" defaultValue={termId} aria-label="Term">
              {terms.map((term) => (
                <option key={term.id} value={term.id}>{term.yearLabel} {term.label}</option>
              ))}
            </select>
          </label>
          {editing ? <input type="hidden" name="edit" value={editing.id} /> : null}
          <Button type="submit" variant="outline">Show term</Button>
        </form>
      </Surface>
      <Surface className="overflow-hidden">
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium text-ink">{item.name}</span>
                <span className="ml-2 text-muted-foreground">{formatMoney(item.amount)}{item.active ? "" : " · inactive"}</span>
              </span>
              <a className="text-blue" href={`/fees/items?edit=${item.id}&termId=${termId}`}>Edit</a>
            </li>
          ))}
          {items.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">No school fee items yet.</li> : null}
        </ul>
      </Surface>
    </div>
  );
}
