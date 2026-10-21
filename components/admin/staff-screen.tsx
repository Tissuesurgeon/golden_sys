"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabel, canManageStaff } from "@/lib/prototype/permissions";
import { className, currentStaff, subjectName } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { Role, Staff } from "@/lib/prototype/types";

export function StaffScreen() {
  const { state, dispatch } = usePrototype();
  const me = currentStaff(state);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [editRole, setEditRole] = useState<Role>("teacher");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  if (!me || !canManageStaff(me.role)) {
    return <Surface className="p-8 text-sm">Staff management is limited to the school administrator.</Surface>;
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Administrators, the bursar, and teachers. An invitation in this preview marks the account as invited."
        actions={<Button onClick={() => setInviteOpen(true)}>Invite staff</Button>}
      />
      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden lg:table-cell">Assignment</TableHead>
              <TableHead>Account</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.staff.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <p className="font-medium text-ink">{member.name}</p>
                  <p className="text-xs break-all text-muted-foreground md:hidden">{member.email}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">{member.email}</TableCell>
                <TableCell>{roleLabel(member.role)}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {member.classIds.map((id) => className(state, id)).join(", ") || "—"}
                  {member.subjectIds.length > 0 ? ` · ${member.subjectIds.map((id) => subjectName(state, id)).join(", ")}` : ""}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={member.status === "active" ? "success" : "warning"}>
                    {member.status === "active" ? "Active" : "Invited"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-sm font-medium text-blue"
                    onClick={() => {
                      setEditing(member);
                      setEditRole(member.role);
                      setClassIds(member.classIds);
                      setSubjectIds(member.subjectIds);
                    }}
                  >
                    Assign role
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>No email is sent. The person appears as invited in this preview.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim().length < 2) {
                setError("Enter the staff name.");
                return;
              }
              if (!email.includes("@")) {
                setError("Enter a valid email address.");
                return;
              }
              if (state.staff.some((member) => member.email.toLowerCase() === email.trim().toLowerCase())) {
                setError("That email is already on the staff list.");
                return;
              }
              dispatch({ type: "invite-staff", name: name.trim(), email: email.trim(), role });
              setInviteOpen(false);
              setName("");
              setEmail("");
              setError("");
            }}
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" aria-label="Full name" />
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Email" />
            <select className={selectClassName()} value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Role">
              <option value="administrator">School Administrator</option>
              <option value="bursar">Accounts / Bursar</option>
              <option value="teacher">Teacher</option>
            </select>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit">Save invitation</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Role and assignment</DialogTitle>
            <DialogDescription>{editing?.name}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm">
            Role
            <select className={selectClassName()} value={editRole} onChange={(event) => setEditRole(event.target.value as Role)}>
              <option value="administrator">School Administrator</option>
              <option value="bursar">Accounts / Bursar</option>
              <option value="teacher">Teacher</option>
            </select>
          </label>
          {editRole === "teacher" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Classes</legend>
                {state.classes.map((room) => (
                  <label key={room.id} className="mb-1 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={classIds.includes(room.id)}
                      onChange={(event) =>
                        setClassIds((current) => (event.target.checked ? [...current, room.id] : current.filter((id) => id !== room.id)))
                      }
                    />
                    {room.name}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Subjects</legend>
                {state.subjects.map((subject) => (
                  <label key={subject.id} className="mb-1 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(subject.id)}
                      onChange={(event) =>
                        setSubjectIds((current) => (event.target.checked ? [...current, subject.id] : current.filter((id) => id !== subject.id)))
                      }
                    />
                    {subject.name}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              if (!editing) return;
              dispatch({
                type: "update-staff",
                staffId: editing.id,
                role: editRole,
                classIds: editRole === "teacher" ? classIds : [],
                subjectIds: editRole === "teacher" ? subjectIds : [],
                status: editing.status === "invited" ? "active" : editing.status,
              });
              setEditing(null);
            }}
          >
            Save assignment
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
