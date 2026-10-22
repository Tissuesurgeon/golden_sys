import { describe, expect, it } from "vitest";
import { enrollmentAllowed } from "@/lib/enrollment";
import { parseCsv, studentImportErrors } from "@/lib/csv";
import { can } from "@/lib/permissions";

describe("enrollment gate", () => {
  it("allows full payment or a waiver that clears the balance", () => {
    expect(enrollmentAllowed({ policy: "full_or_waiver", total: 50000, paid: 50000, adjustments: 0, minimumDeposit: 0 })).toBe(true);
    expect(enrollmentAllowed({ policy: "full_or_waiver", total: 50000, paid: 0, adjustments: -50000, minimumDeposit: 0 })).toBe(true);
    expect(enrollmentAllowed({ policy: "full_or_waiver", total: 50000, paid: 20000, adjustments: 0, minimumDeposit: 0 })).toBe(false);
  });

  it("keeps overpayment as a cleared balance", () => {
    expect(enrollmentAllowed({ policy: "full_or_waiver", total: 50000, paid: 60000, adjustments: 0, minimumDeposit: 0 })).toBe(true);
  });

  it("accepts a minimum deposit when that gate is selected", () => {
    expect(enrollmentAllowed({ policy: "minimum_deposit", total: 50000, paid: 20000, adjustments: 0, minimumDeposit: 20000 })).toBe(true);
    expect(enrollmentAllowed({ policy: "minimum_deposit", total: 50000, paid: 10000, adjustments: 0, minimumDeposit: 20000 })).toBe(false);
  });
});

describe("permissions", () => {
  it("keeps teachers out of finance and bursars out of publishing", () => {
    expect(can("teacher", "finance.read")).toBe(false);
    expect(can("bursar", "academics.publish")).toBe(false);
    expect(can("administrator", "audit.read")).toBe(true);
  });
});

describe("csv import", () => {
  it("reports a row error and does not hide later rows", () => {
    const parsed = parseCsv("admissionNumber,firstName,lastName,sex,dateOfBirth,className\nGCS1,Ama,Mensah,Female,2015-01-02,Basic 4\nGCS1,Kojo,Bad,Child,01/02/2015,Unknown\n");
    const errors = studentImportErrors(parsed.rows, [], ["Basic 4"]);
    expect(errors.some((error) => error.includes("Line 3"))).toBe(true);
    expect(errors.length).toBeGreaterThan(1);
    expect(parsed.rows).toHaveLength(2);
  });
});
