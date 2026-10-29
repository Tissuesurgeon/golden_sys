# golden_sys: security fixes + invoice generation, finance report, teacher portal

You are working in this repo (golden_sys): Next.js 16 App Router, React 19, TypeScript, Prisma 6 + Postgres, Tailwind v4 + shadcn/ui, argon2 auth, pdf-lib PDFs, vitest + Playwright. School: Golden Child School (Ghana, KG–JHS). Roles: administrator, bursar, teacher. Money is stored as integer pesewas; keep it that way. Read AGENTS.md first and follow it.

Work in the phases below, in order. After each phase run `npx tsc --noEmit`, `npx eslint .` and `npx vitest run`, fix anything that breaks, and make one commit per phase with a clear message. Create Prisma migrations with `npx prisma migrate dev --name <name>`; never edit existing migration files. Keep the existing UI style and components.

## Phase 1: security and money fixes (do these first)

1. Teacher data scope (`lib/server/snapshot.ts` ~line 66): if role is teacher and the user has no `staffId`, return an empty scoped view (no students, sheets or staff), never the unfiltered data.
2. Report card PDF access (`app/api/pdf/[kind]/[id]/route.ts` report branch ~109-116): a teacher may only download report cards for students in classes they are assigned to (TeacherAssignment or ClassRoom.teacherId) for the current year, and only published versions. Administrators keep full access. Return 403 otherwise. Apply the same ownership check to every other kind in that route and to `app/api/documents/[id]/route.ts`.
3. Stop sending the whole database to the browser: `app/(app)/layout.tsx` calls `loadSnapshot`, which runs ~14 unfiltered findMany queries on every navigation and hands everything to a client provider. Replace it step by step with per-page server data loading: each page queries only what it needs, with role-based filters, `select` for needed fields, and pagination/limits on lists. The layout should load only the session user, school settings and nav. Remove `lib/prototype/*` once nothing imports it. Replace the untyped `commitAction({type})` dispatcher with one typed server action per operation, validated with zod, each checking permissions; unknown operations must throw.
4. Sign-in rate limiting (`lib/auth.ts` signInWithPassword, `lib/server/actions.ts`): add a `LoginAttempt` table (email, ip, success, createdAt) and lock out after 5 failed attempts per email or per IP within 15 minutes, with a generic error message. Also invalidate older unused password-reset tokens when a new one is issued.
5. Payment allocation caps (`lib/server/mutate.ts` ~280-287): inside the same transaction, reject any allocation that is ≤ 0 or larger than that invoice's remaining balance, and reject if the allocations' sum exceeds the payment amount. Add vitest tests for these money rules.

Also in this phase: add `@@index` on foreign keys used for lookups (studentId, invoiceId, paymentId, sheetId, classId, termId, staffId) and on `AuditLog(entityType, entityId, createdAt)`; restrict document uploads to PDF/JPEG/PNG checked by file signature, serve them with `X-Content-Type-Options: nosniff`, and make sure stored paths stay inside the storage folder; fix the staff CSV import error redirect in `lib/server/forms.ts` (~216) to go to the staff import page; always store the user ID in `recordedById`.

## Phase 2: invoice generation

- Link fees to terms: add `termId` (relation to `Term`) on Invoice (keep `termLabel` for display, backfilled) and make fee items configurable per class and per term (e.g. a `FeeSchedule`/`FeeItemClass` with amount per class + term, or add termId to the existing link table; choose the simplest clean model).
- Fee items page (admin + bursar): list, create, edit, deactivate fee items, set who each applies to (new / returning / all students), and set amounts per class for a chosen term.
- Generate term invoices (admin + bursar): pick academic year + term + one class or all classes → preview table (student, class, line items, arrears brought forward, total, and a grand total) → confirm. One invoice per student per term; enforce with a unique constraint on (studentId, termId, kind) so running it twice never creates duplicates (skip and report students who already have one). Run inside a transaction and write an audit log entry.
- New vs old (returning) students, both invoiced by administrator AND bursar (both roles need an `invoices.generate` permission; teachers never):
  - Mark each fee item with who it applies to: `new` (first term at the school only, e.g. admission/registration, uniform, PTA levy), `returning` (continuing students only), or `all` (tuition, feeding, etc.). A student counts as new for a term if it is their first enrolled term (derive from enrolment/admission date or an `isNewStudent` flag set at admission and cleared after their first term; pick one and document it).
  - Generate term invoices (above) applies the right items per student automatically, and the preview shows a New/Returning column plus filters so the user can generate for new students only, returning students only, or both.
  - Single-student invoice: from a student's profile or the invoices page, administrator or bursar can generate (or regenerate if none exists yet) that student's invoice for a chosen term, using the same new/returning rules, with the same preview → confirm step and the same no-duplicate rule. Use this for mid-term admissions and late joiners.
  - Admissions: when an applicant is admitted and enrolled, offer "Generate first-term invoice" right there (new-student items + all-student items), instead of the current silent auto-invoice in `lib/server/mutate.ts` ~189-205; remove the automatic invoice on student creation so invoices are always created deliberately and never twice.
  - Optional manual extra line items (with a reason) on single-student invoices, e.g. a lost-book charge, so one-off charges don't need a new fee item.
- Arrears carry forward: when generating, any unpaid balance from earlier terms appears as a separate "Arrears brought forward" line. Don't double count: mark the old invoice as carried forward (new status `carried_forward` or a link `carriedToInvoiceId`) and exclude it from outstanding totals once carried.
- Due date on invoices (default from term start + a configurable number of days in SchoolSettings); invoices past due with balance > 0 show as overdue (compute it, or set it in a query; no cron needed).
- Cancel invoice (admin only) with a required reason; only if no payments are allocated; write an audit log entry.
- Keep using the existing `Adjustment` mechanism for discounts. Do not add a scholarship model.
- Invoice page at `/fees/invoices` (list with filters: term, class, status, search) and `/fees/invoices/[id]` (on-screen view with school logo, student, line items, payments, balance, print button), plus a proper A4 PDF with the school header, a table of line items, totals and page breaks (rework the plain-text PDF helper used in the pdf route so all PDFs wrap long text and break pages).
- Per-year numbering: `INV-2026-00001`, `RCT-2026-00001` (counter per prefix per year; existing numbers stay as they are).

## Phase 3: finance report (fees income only, no expenses)

- New `/finance` page (admin + bursar, add to nav), filters: date range, academic year, term, class.
- Summary cards: billed, collected, outstanding, collection rate.
- Breakdowns: collections by payment method (cash, mobile money, bank transfer, other), by fee item, and by class, plus a collections-over-time chart (recharts, already used in the app).
- Arrears ageing: outstanding balances grouped 0–30, 31–60, 61–90, 90+ days past due, and a debtors list (student, class, guardian phone, amount, oldest due date) linking to the student statement.
- Daily cash summary: for a chosen date, every payment by method and the person who recorded it, with totals, printable.
- Export every table as CSV (write a small CSV writer in `lib/csv.ts`) and the report as PDF.
- All totals must use one shared balance function that excludes cancelled, reversed and carried-forward invoices, and the fee statement PDF must use the same function so screen and PDF always agree.

## Phase 4: teacher portal

- Teacher home `/my` (teachers land here after sign-in): their classes and subjects for the current term, mark sheets grouped by status (not started, saved, submitted, returned, approved), with deadlines (add an optional deadline to assessment setup).
- My marks: marks entry for only their assigned class + subject, save and submit (keep the existing administrator return/approve/publish flow).
- Daily attendance: new `Attendance` model (studentId, classId, termId, date, status: present | absent | late | excused, note, recordedById), unique per student + date. The class teacher (ClassRoom.teacherId) marks the whole class for a day from one screen (default everyone present, tap to change), can edit past days in the current term, and sees a monthly register. Administrators can view all classes.
- Report cards show attendance for the term: days present out of days the school was open (count distinct dates with any attendance recorded for that class), plus times absent and late.
- Class teacher section: per student per term, a class teacher remark and conduct/attitude/interest fields (new `TermReport` or similar model), shown on the report card separately from subject remarks.
- Positions: compute position in each subject and overall position in class for Primary and JHS (ties share a position, e.g. 1, 2, 2, 4), show them on results and report cards. KG has no positions.
- The class teacher can view and print report cards only for their own class.
- Printable/exportable class roster.
- Change-my-password page for every signed-in user (current password required).
- Teacher nav shows only: My Classes, Marks, Attendance, Report Cards, My Account.

## Finish

- Update `docs/operations.md` with a backup plan (nightly pg_dump + storage sync, and how to restore) and replace the default README with what the app does, how to run it locally, seed it and deploy it.
- Add tests: vitest for permissions/scoping, invoice generation (no duplicates, arrears carry forward, new vs returning fee items, single-student invoice by admin and bursar but not teacher), balance function, positions with ties, attendance totals; extend `e2e/journeys.spec.ts` with a bursar generating term invoices and a teacher marking attendance.
- Final message to me: what changed per phase, the new migrations, anything you were unsure about, and anything left undone.
