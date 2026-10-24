export type RecordKind =
  "entry" | "vat" | "obligation" | "declaration" | "document" | "customs" | "payroll" | "rent";
export type Value = string | boolean;
export interface FieldDefinition {
  key: string;
  type: "text" | "money" | "signedMoney" | "date" | "url" | "boolean" | "select";
  required: boolean;
  default?: Value;
  options?: string[];
}
export interface RecordDefinition {
  statuses: string[];
  fields: FieldDefinition[];
}
export interface AccountingCatalog {
  schemaVersion: 1;
  records: Record<RecordKind, RecordDefinition>;
  payrollRules: {
    id: string;
    from: string;
    to: string;
    verifiedOn: string;
    sources: string[];
    rounding: string;
  };
  rentSources: string[];
  limits: { documentBytes: number; importBytes: number; archiveBytes: number };
}
export interface RecordInput {
  kind: RecordKind;
  title: string;
  period: string;
  status: string;
  source: "manual" | "portal";
  sourceReference: string;
  notes: string;
  data: Record<string, Value>;
}
export interface AccountingRecord extends RecordInput {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  calculation: Record<string, string | boolean | number | null> | null;
  attachment: { name: string; mime: string; sha256: string; size: number } | null;
}
export interface WorkspaceSummary {
  records: number;
  outstanding: string;
  openDeclarations: number;
  overdueDeclarationIds: string[];
  pendingDocuments: number;
  payrollNeedsReview: number;
  asOf: string;
}
export interface AccountingState {
  schemaVersion: 1;
  nipt: string;
  records: AccountingRecord[];
  summary: WorkspaceSummary;
}
export interface MonthlyFinance {
  period: string;
  turnover: string | null;
  purchases: string | null;
  supplementalIncome: string;
  supplementalExpenses: string;
  payrollCost: string;
  recordedResult: string;
}
export interface FinanceResult {
  sources?: {
    cis: "excluded" | "certificate_required" | "partial" | "loaded";
    sales: boolean;
    purchases: boolean;
  };
  finance: {
    from: string;
    to: string;
    currency: string;
    sales: { net: string; vat: string } | null;
    purchases: { net: string; vat: string } | null;
    supplementalIncome: string;
    supplementalExpenses: string;
    payrollCost: string;
    recordedIncome: string;
    recordedExpenses: string;
    recordedResult: string;
    cisComplete: boolean;
    includedRecordIds: string[];
    months: MonthlyFinance[];
  };
  vat: {
    cisOutputVat: string | null;
    cisInputVat: string | null;
    recordedOutputVat: string | null;
    recordedInputVat: string | null;
    outputDifference: string | null;
    inputDifference: string | null;
    source: string | null;
    sourceReference: string | null;
    reviewId: string | null;
    preparation: Record<string, string | boolean> | null;
  };
  errors: Record<string, { message: string }>;
}
export interface NetResult {
  requestedNet: string;
  exact: boolean;
  ambiguous: boolean;
  solutions: Record<string, string | boolean>[];
  nearest: Record<string, string | boolean> | null;
  ruleId: string;
}
export interface CustomsCheck {
  id: string;
  reference: string;
  matches: number;
  invoiceFics: string[];
  declaredImportVat: string;
  invoiceVat: string | null;
  difference: string | null;
  evidenceAttached: boolean;
}
