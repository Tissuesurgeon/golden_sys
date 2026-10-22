export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]));
  });
  return { headers, rows };
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

export function studentImportErrors(rows: CsvRow[], knownAdmissions: string[], classNames: string[]) {
  const required = ["admissionNumber", "firstName", "lastName", "sex", "dateOfBirth", "className"];
  const seen = new Set<string>();
  return rows.flatMap((row, index) => {
    const line = index + 2;
    const messages: string[] = [];
    for (const field of required) if (!row[field]) messages.push(`Line ${line}: ${field} is required.`);
    if (row.sex && row.sex !== "Female" && row.sex !== "Male") messages.push(`Line ${line}: sex must be Female or Male.`);
    if (row.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(row.dateOfBirth)) messages.push(`Line ${line}: dateOfBirth must be YYYY-MM-DD.`);
    if (row.className && !classNames.includes(row.className)) messages.push(`Line ${line}: class "${row.className}" was not found.`);
    const key = row.admissionNumber?.toLowerCase();
    if (key && (knownAdmissions.includes(key) || seen.has(key))) messages.push(`Line ${line}: admission number ${row.admissionNumber} is already used.`);
    if (key) seen.add(key);
    return messages;
  });
}

export function guardianImportErrors(rows: CsvRow[], admissions: string[]) {
  return rows.flatMap((row, index) => {
    const line = index + 2;
    const messages: string[] = [];
    for (const field of ["fullName", "phone", "studentAdmission", "relationship"]) {
      if (!row[field]) messages.push(`Line ${line}: ${field} is required.`);
    }
    if (row.studentAdmission && !admissions.includes(row.studentAdmission.toLowerCase())) {
      messages.push(`Line ${line}: student ${row.studentAdmission} was not found.`);
    }
    return messages;
  });
}

export function staffImportErrors(rows: CsvRow[]) {
  return rows.flatMap((row, index) => {
    const line = index + 2;
    const messages: string[] = [];
    if (!row.name) messages.push(`Line ${line}: name is required.`);
    if (!row.email || !row.email.includes("@")) messages.push(`Line ${line}: email is required.`);
    if (row.role && !["administrator", "bursar", "teacher"].includes(row.role)) {
      messages.push(`Line ${line}: role must be administrator, bursar, or teacher.`);
    }
    if (!row.role) messages.push(`Line ${line}: role is required.`);
    return messages;
  });
}
