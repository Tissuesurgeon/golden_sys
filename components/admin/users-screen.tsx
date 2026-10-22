"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials } from "@/lib/format";
import { resetLinkAction, setActiveAction } from "@/lib/server/actions";

type Account = { id: string; name: string; email: string; role: string; active: boolean };

const roleLabel: Record<string, string> = {
  administrator: "School administrator",
  bursar: "Accounts / Bursar",
  teacher: "Teacher",
};

export function UsersScreen({ accounts }: { accounts: Account[] }) {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div>
      <PageHeader title="Users and Permissions" description="Deactivate an account to end its sessions. Reset links are shown here until email is configured." />
      {link ? (
        <div className="mb-4 rounded-xl bg-gold-pale px-4 py-3 text-sm">
          <p className="font-medium text-ink">Reset link, shown once</p>
          <p className="mt-1 break-all text-ink">{link}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(link)}>
            Copy link
          </Button>
        </div>
      ) : null}
      {message ? <p className="mb-4 text-sm text-danger">{message}</p> : null}
      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">{initials(account.name)}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{account.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{roleLabel[account.role] ?? account.role}</TableCell>
                <TableCell>
                  <StatusBadge tone={account.active ? "success" : "warning"}>{account.active ? "Active" : "Deactivated"}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const issued = await resetLinkAction(account.id);
                        setLink(`${window.location.origin}/reset?token=${issued.token}`);
                        setMessage("");
                      }}
                    >
                      Issue reset link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await setActiveAction(account.id, !account.active);
                        setMessage(result.error);
                        if (!result.error) window.location.reload();
                      }}
                    >
                      {account.active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
