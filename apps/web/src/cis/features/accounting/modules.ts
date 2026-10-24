import type { RecordKind } from "./types";
export const MODULES = [
  { id: "invoices", number: "01", category: "finance", kind: null },
  { id: "vat", number: "02", category: "declarations", kind: "vat" },
  { id: "obligations", number: "03", category: "finance", kind: "obligation" },
  { id: "finance", number: "04", category: "finance", kind: "entry" },
  { id: "comparison", number: "05", category: "checks", kind: "vat" },
  { id: "rent", number: "06", category: "declarations", kind: "rent" },
  { id: "payroll", number: "07", category: "payroll", kind: "payroll" },
  { id: "customs", number: "08", category: "checks", kind: "customs" },
  { id: "netGross", number: "09", category: "payroll", kind: "payroll" },
  { id: "documents", number: "10", category: "checks", kind: "document" },
  { id: "outstanding", number: "11", category: "checks", kind: "declaration" },
  { id: "income", number: "12", category: "finance", kind: "entry" },
] as const satisfies readonly { id: string; number: string; category: string; kind: RecordKind | null }[];
export type ModuleId = (typeof MODULES)[number]["id"];
