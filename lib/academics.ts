export function ranksWithTies(rows: { id: string; total: number }[]) {
  const sorted = [...rows].sort((left, right) => right.total - left.total || left.id.localeCompare(right.id));
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    const rank = previous && previous.total === row.total ? (ranks.get(previous.id) ?? index + 1) : index + 1;
    ranks.set(row.id, rank);
  });
  return ranks;
}

export function showsPosition(level: string) {
  return level === "Primary" || level === "JHS";
}

export function attendanceTotals(rows: { status: string }[], daysOpen: number) {
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  return { present: count("present"), absent: count("absent"), late: count("late"), excused: count("excused"), daysOpen };
}
