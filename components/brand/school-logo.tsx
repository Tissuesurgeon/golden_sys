import { cn } from "@/lib/utils";

const LOGO_SRC = "/images/golden-child-school-logo.jpg";

export function SchoolLogo({
  size = 72,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    // The crest is a supplied JPEG with a white field. It is scaled only, never redrawn.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="Golden Child School crest. Motto: Knowledge is power."
      width={size}
      height={size}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
