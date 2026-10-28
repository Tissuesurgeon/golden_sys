import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-navy">Not allowed</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Your account cannot generate invoices. Ask the administrator or the bursar.</p>
      <Link className="mt-4 text-sm font-medium text-blue" href="/dashboard">Back to the dashboard</Link>
    </main>
  );
}
