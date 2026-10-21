import { SchoolLogo } from "@/components/brand/school-logo";
import type { SchoolSettings } from "@/lib/prototype/types";

export function DocumentHeader({ school, kicker }: { school: SchoolSettings; kicker: string }) {
  return (
    <header className="border-b border-border pb-4 text-center">
      <SchoolLogo size={108} className="mx-auto" />
      <h1 className="mt-2 text-xl font-semibold break-words text-navy sm:text-[22px]">{school.name}</h1>
      <p className="text-xs break-words text-muted-foreground">{school.address}</p>
      <p className="text-xs text-muted-foreground">
        {school.region}, {school.country}
      </p>
      <p className="text-xs break-words text-muted-foreground">
        {school.phone} · {school.email}
      </p>
      <div className="mx-auto mt-3 h-px w-16 bg-gold" />
      <p className="mt-3 text-sm font-semibold tracking-wide text-navy">{kicker}</p>
    </header>
  );
}
