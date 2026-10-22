"use client";

import { useState } from "react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { PageHeader, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canManageSettings, roleLabel } from "@/lib/prototype/permissions";
import { currentStaff } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { SchoolSettings } from "@/lib/prototype/types";

export function SettingsScreen() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const [school, setSchool] = useState(state.school);
  const [saved, setSaved] = useState("");

  if (!staff || !canManageSettings(staff.role)) {
    return <Surface className="p-8 text-sm">School settings are limited to the school administrator.</Surface>;
  }

  return (
    <div>
      <PageHeader title="School settings" description="School identity, academic year, and the enrollment gate. The crest is the supplied Golden Child School badge." />
      <Tabs defaultValue="general">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="academic">Academic setup</TabsTrigger>
          <TabsTrigger value="users">Users and roles</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <Surface className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              School name
              <Input value={school.name} onChange={(event) => setSchool({ ...school, name: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              Motto
              <Input value={school.motto} readOnly />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              Address
              <Input value={school.address} onChange={(event) => setSchool({ ...school, address: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              Phone
              <Input value={school.phone} onChange={(event) => setSchool({ ...school, phone: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              Email
              <Input value={school.email} onChange={(event) => setSchool({ ...school, email: event.target.value })} />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">These details appear on receipts, statements, and report cards.</p>
            <div>
              <Button
                type="button"
                onClick={() => {
                  dispatch({ type: "update-school", school });
                  setSaved("General settings saved.");
                }}
              >
                Save general settings
              </Button>
              {saved ? <p className="mt-2 text-sm text-success">{saved}</p> : null}
            </div>
          </Surface>
        </TabsContent>
        <TabsContent value="branding" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Surface className="p-5">
            <h2 className="text-lg font-semibold text-navy">In the application</h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3">
              <SchoolLogo size={64} />
              <div>
                <p className="text-sm font-semibold text-navy">{school.name}</p>
                <p className="text-xs text-muted-foreground">{school.town}</p>
                <div className="mt-2 h-px w-8 bg-gold" />
              </div>
            </div>
          </Surface>
          <Surface className="p-5 text-center">
            <h2 className="text-left text-lg font-semibold text-navy">On a printed document</h2>
            <SchoolLogo size={120} className="mx-auto mt-4" />
            <p className="mt-2 text-base font-semibold text-navy">{school.name}</p>
            <p className="text-xs text-muted-foreground">{school.address}</p>
            <div className="mx-auto mt-3 h-px w-12 bg-gold" />
            <p className="mt-3 text-xs text-muted-foreground">The crest is scaled from the original file. It is not redrawn.</p>
          </Surface>
        </TabsContent>
        <TabsContent value="academic" className="mt-4">
          <Surface className="space-y-3 p-5">
            <label className="block max-w-xs space-y-1.5 text-sm">
              Current academic year
              <Input value={school.academicYear} onChange={(event) => setSchool({ ...school, academicYear: event.target.value })} />
            </label>
            <label className="block max-w-xs space-y-1.5 text-sm">
              Current term
              <Input value={school.currentTerm} onChange={(event) => setSchool({ ...school, currentTerm: event.target.value })} />
            </label>
            <label className="block max-w-xs space-y-1.5 text-sm">
              Enrollment gate
              <select
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
                value={school.enrollmentPolicy ?? "full_or_waiver"}
                onChange={(event) => setSchool({ ...school, enrollmentPolicy: event.target.value as SchoolSettings["enrollmentPolicy"] })}
              >
                <option value="full_or_waiver">Full payment or waiver</option>
                <option value="minimum_deposit">Minimum deposit</option>
                <option value="waiver_only">Authorized waiver</option>
              </select>
            </label>
            <label className="block max-w-xs space-y-1.5 text-sm">
              Minimum deposit (pesewas)
              <Input value={String(school.minimumDeposit ?? 0)} onChange={(event) => setSchool({ ...school, minimumDeposit: Number(event.target.value) || 0 })} />
            </label>
            <label className="block max-w-xs space-y-1.5 text-sm">
              Admission fee (pesewas)
              <Input value={String(school.admissionFee ?? 0)} onChange={(event) => setSchool({ ...school, admissionFee: Number(event.target.value) || 0 })} />
            </label>
            <div>
              <p className="text-sm font-medium">Grading scale</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {school.grading.map((band) => (
                  <li key={band.grade}>
                    {band.grade} · {band.label} · {band.min} and above
                  </li>
                ))}
              </ul>
            </div>
            <Button type="button" onClick={() => dispatch({ type: "update-school", school })}>
              Save academic setup
            </Button>
          </Surface>
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <Surface className="p-5">
            <ul className="space-y-3 text-sm">
              {state.staff.map((member) => (
                <li key={member.id} className="flex justify-between gap-3 border-b border-border py-2">
                  <span>{member.name}</span>
                  <span className="text-muted-foreground">{roleLabel(member.role)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Administrators manage the school. The bursar records fees. Teachers enter marks for assigned classes and do not see balances.
            </p>
          </Surface>
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <Surface className="space-y-3 p-5">
            <p className="text-sm text-ink">Sessions are stored in the database and expire after 14 days. Signing out ends the session.</p>
            <p className="text-sm text-muted-foreground">
              An administrator issues password reset links from Users and Permissions. Email delivery starts when SMTP_URL is configured.
            </p>
          </Surface>
        </TabsContent>
      </Tabs>
    </div>
  );
}
