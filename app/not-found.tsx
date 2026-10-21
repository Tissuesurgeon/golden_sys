import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-navy">This page is not in the school workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Return to the sign-in page and open the section you need.</p>
        <Link href="/login" className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
