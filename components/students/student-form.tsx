"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectClassName } from "@/components/common/ui-bits";
import type { Student } from "@/lib/prototype/types";

const schema = z.object({
  firstName: z.string().trim().min(2, "Enter the first name."),
  lastName: z.string().trim().min(2, "Enter the last name."),
  otherNames: z.string().trim(),
  admissionNumber: z.string().trim().min(4, "Enter the admission number."),
  sex: z.enum(["Female", "Male"], { message: "Choose female or male." }),
  dateOfBirth: z.string().min(1, "Enter the date of birth."),
  classId: z.string().min(1, "Choose a class."),
  status: z.enum(["enrolled", "withdrawn", "graduated"]),
  enrolledOn: z.string().min(1, "Enter the enrolment date."),
  residentialAddress: z.string().trim().min(3, "Enter the residential address."),
  guardianName: z.string().trim(),
  guardianPhone: z.string().trim(),
  guardianRelationship: z.string().trim(),
});

export type StudentFormValues = z.infer<typeof schema>;

export function StudentForm({
  classes,
  initial,
  requireGuardian,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  classes: Array<{ id: string; name: string }>;
  initial?: Partial<StudentFormValues>;
  requireGuardian?: boolean;
  submitLabel: string;
  onSubmit: (values: StudentFormValues) => string | void | Promise<string | void>;
  onCancel?: () => void;
}) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      otherNames: "",
      admissionNumber: "",
      sex: "Female",
      dateOfBirth: "",
      classId: classes[0]?.id ?? "",
      status: "enrolled",
      enrolledOn: new Date().toISOString().slice(0, 10),
      residentialAddress: "",
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "Mother",
      ...initial,
    },
  });

  const errors = form.formState.errors;

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        if (requireGuardian && values.guardianName.trim().length < 2) {
          form.setError("guardianName", { message: "Enter the guardian's name." });
          return;
        }
        if (requireGuardian && values.guardianPhone.trim().length < 6) {
          form.setError("guardianPhone", { message: "Enter a phone number." });
          return;
        }
        const message = await onSubmit(values);
        if (typeof message === "string") form.setError("admissionNumber", { message });
      })}
      noValidate
    >
      <Field name="First name" error={errors.firstName?.message}>
        <Input aria-invalid={Boolean(errors.firstName)} {...form.register("firstName")} />
      </Field>
      <Field name="Last name" error={errors.lastName?.message}>
        <Input aria-invalid={Boolean(errors.lastName)} {...form.register("lastName")} />
      </Field>
      <Field name="Other names" error={errors.otherNames?.message}>
        <Input {...form.register("otherNames")} />
      </Field>
      <Field name="Admission number" error={errors.admissionNumber?.message}>
        <Input aria-invalid={Boolean(errors.admissionNumber)} {...form.register("admissionNumber")} />
      </Field>
      <Field name="Sex" error={errors.sex?.message}>
        <select className={selectClassName(Boolean(errors.sex))} {...form.register("sex")}>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
      </Field>
      <Field name="Date of birth" error={errors.dateOfBirth?.message}>
        <Input type="date" aria-invalid={Boolean(errors.dateOfBirth)} {...form.register("dateOfBirth")} />
      </Field>
      <Field name="Class" error={errors.classId?.message}>
        <select className={selectClassName(Boolean(errors.classId))} {...form.register("classId")}>
          {classes.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </Field>
      <Field name="Status" error={errors.status?.message}>
        <select className={selectClassName()} {...form.register("status")}>
          <option value="enrolled">Enrolled</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="graduated">Graduated</option>
        </select>
      </Field>
      <Field name="Enrolled on" error={errors.enrolledOn?.message}>
        <Input type="date" {...form.register("enrolledOn")} />
      </Field>
      <Field name="Residential address" error={errors.residentialAddress?.message}>
        <Input aria-invalid={Boolean(errors.residentialAddress)} {...form.register("residentialAddress")} />
      </Field>
      {requireGuardian ? (
        <>
          <Field name="Primary guardian" error={errors.guardianName?.message}>
            <Input aria-invalid={Boolean(errors.guardianName)} {...form.register("guardianName")} />
          </Field>
          <Field name="Relationship" error={errors.guardianRelationship?.message}>
            <Input {...form.register("guardianRelationship")} />
          </Field>
          <Field name="Guardian phone" error={errors.guardianPhone?.message}>
            <Input aria-invalid={Boolean(errors.guardianPhone)} {...form.register("guardianPhone")} />
          </Field>
        </>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

function Field({ name, error, children }: { name: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink">{name}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function toStudent(id: string, values: StudentFormValues): Student {
  return {
    id,
    admissionNumber: values.admissionNumber,
    firstName: values.firstName,
    lastName: values.lastName,
    otherNames: values.otherNames,
    sex: values.sex,
    dateOfBirth: values.dateOfBirth,
    classId: values.classId,
    status: values.status,
    enrolledOn: values.enrolledOn,
    residentialAddress: values.residentialAddress,
  };
}
