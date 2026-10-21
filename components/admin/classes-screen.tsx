"use client";

import { useState } from "react";
import { PageHeader, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectClassName } from "@/components/common/ui-bits";
import { canConfigureAcademics } from "@/lib/prototype/permissions";
import { currentStaff, staffById, studentsInClass } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { ClassRoom } from "@/lib/prototype/types";

export function ClassesScreen() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const canEdit = staff ? canConfigureAcademics(staff.role) : false;
  const [classQuery, setClassQuery] = useState("");
  const [subjectQuery, setSubjectQuery] = useState("");
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<ClassRoom["level"]>("Primary");
  const [teacherId, setTeacherId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [code, setCode] = useState("");
  const [levels, setLevels] = useState<Array<ClassRoom["level"]>>(["Primary"]);
  const [error, setError] = useState("");

  const classes = state.classes.filter((room) => room.name.toLowerCase().includes(classQuery.trim().toLowerCase()));
  const subjects = state.subjects.filter((subject) => `${subject.name} ${subject.code}`.toLowerCase().includes(subjectQuery.trim().toLowerCase()));

  return (
    <div>
      <PageHeader title="Classes and subjects" description="Classes carry a class teacher. Subjects apply to KG, Primary, or JHS." />
      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="classes" className="mt-4">
          <Surface>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <Input value={classQuery} onChange={(event) => setClassQuery(event.target.value)} placeholder="Search classes" aria-label="Search classes" className="min-w-0 flex-1 sm:max-w-xs" />
              {canEdit ? (
                <Button
                  onClick={() => {
                    setEditing({ id: "", name: "", level: "Primary", teacherId: null });
                    setName("");
                    setLevel("Primary");
                    setTeacherId("");
                    setError("");
                  }}
                >
                  Add class
                </Button>
              ) : null}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Class teacher</TableHead>
                  <TableHead className="hidden sm:table-cell">Period</TableHead>
                  {canEdit ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>{room.name}</TableCell>
                    <TableCell>{room.level}</TableCell>
                    <TableCell>{studentsInClass(state, room.id).length}</TableCell>
                    <TableCell>{staffById(state, room.teacherId)?.name ?? "Unassigned"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{state.year}</TableCell>
                    {canEdit ? (
                      <TableCell>
                        <button
                          type="button"
                          className="text-sm font-medium text-blue"
                          onClick={() => {
                            setEditing(room);
                            setName(room.name);
                            setLevel(room.level);
                            setTeacherId(room.teacherId ?? "");
                          }}
                        >
                          Edit
                        </button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        </TabsContent>
        <TabsContent value="subjects" className="mt-4">
          <Surface>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <Input value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder="Search subjects" aria-label="Search subjects" className="min-w-0 flex-1 sm:max-w-xs" />
              {canEdit ? <Button onClick={() => setSubjectOpen(true)}>Add subject</Button> : null}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Levels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>{subject.name}</TableCell>
                    <TableCell>{subject.code}</TableCell>
                    <TableCell>{subject.levels.join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit class" : "Add class"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim().length < 2) {
                setError("Enter the class name.");
                return;
              }
              dispatch({
                type: "upsert-class",
                classRoom: {
                  id: editing?.id || `cls-${Date.now()}`,
                  name: name.trim(),
                  level,
                  teacherId: teacherId || null,
                },
              });
              setEditing(null);
            }}
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Class name" aria-label="Class name" />
            <select className={selectClassName()} value={level} onChange={(event) => setLevel(event.target.value as ClassRoom["level"])} aria-label="Level">
              <option value="KG">KG</option>
              <option value="Primary">Primary</option>
              <option value="JHS">JHS</option>
            </select>
            <select className={selectClassName()} value={teacherId} onChange={(event) => setTeacherId(event.target.value)} aria-label="Class teacher">
              <option value="">Unassigned</option>
              {state.staff
                .filter((member) => member.role === "teacher")
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit">Save class</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add subject</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (subjectName.trim().length < 2 || code.trim().length < 2) return;
              dispatch({
                type: "upsert-subject",
                subject: { id: `sub-${Date.now()}`, name: subjectName.trim(), code: code.trim().toUpperCase(), levels },
              });
              setSubjectOpen(false);
              setSubjectName("");
              setCode("");
            }}
          >
            <Input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Subject name" aria-label="Subject name" />
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code" aria-label="Subject code" />
            <div className="flex gap-3 text-sm">
              {(["KG", "Primary", "JHS"] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levels.includes(item)}
                    onChange={(event) =>
                      setLevels((current) => (event.target.checked ? [...current, item] : current.filter((levelName) => levelName !== item)))
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
            <Button type="submit">Save subject</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
