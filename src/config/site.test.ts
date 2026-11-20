import { describe, expect, it } from "vitest";
import {
  createInvoiceNumber,
  createReceiptNumber,
  createReconciliationNumber,
  createRefundNumber,
  createRegistrationNumber,
  createReportNumber,
  year,
} from "@/config/site";

describe("SPMB document numbers", () => {
  it("formats registration, payment, receipt, and report references with the configured year", () => {
    expect(createRegistrationNumber(128)).toBe(`CN-${year}-00128`);
    expect(createInvoiceNumber(128)).toBe(`INV/CN/${year}/00128`);
    expect(createRefundNumber(1)).toBe(`RF-${year}-001`);
    expect(createReceiptNumber(131)).toBe(`KWT-${year}-00131`);
    expect(createReportNumber(1)).toBe(`EXE/CN/${year}/G1/001`);
    expect(createReconciliationNumber(1, 16)).toBe(`REC-${year}0116`);
  });
});
