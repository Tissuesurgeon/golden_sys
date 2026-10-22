export function parseYear(label: string) {
  const [start, end] = label.split("/").map((part) => Number(part));
  return { start, end: end || start + 1 };
}

export function dateOnly(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function termRange(yearLabel: string, term: string) {
  if (yearLabel === "2025/2026") {
    if (term === "Term 1") return { startsOn: dateOnly("2026-09-01"), endsOn: dateOnly("2026-12-18") };
    if (term === "Term 2") return { startsOn: dateOnly("2027-01-08"), endsOn: dateOnly("2027-04-10") };
    return { startsOn: dateOnly("2027-04-20"), endsOn: dateOnly("2027-07-31") };
  }
  const { start, end } = parseYear(yearLabel);
  if (term === "Term 1") return { startsOn: dateOnly(`${start}-09-01`), endsOn: dateOnly(`${start}-12-18`) };
  if (term === "Term 2") return { startsOn: dateOnly(`${end}-01-08`), endsOn: dateOnly(`${end}-04-10`) };
  return { startsOn: dateOnly(`${end}-04-20`), endsOn: dateOnly(`${end}-07-31`) };
}

export function yearRange(yearLabel: string) {
  const first = termRange(yearLabel, "Term 1");
  const last = termRange(yearLabel, "Term 3");
  return { startsOn: first.startsOn, endsOn: last.endsOn };
}

export function yearId(label: string) {
  return `year-${label.replace("/", "-")}`;
}

export function termId(yearLabel: string, term: string) {
  return `term-${yearLabel.replace("/", "-")}-${term.replace(/\s+/g, "-").toLowerCase()}`;
}
