/**
 * Shtresa e integrimeve (connectors) — Faza 1.
 * Çdo burim i jashtëm implementon këtë interface; statusi shfaqet në UI siç është.
 * Asnjë connector NUK shkruan në databazë vetë: kthen NormalizedRecord[] që Server Action-i i fut me transaksion + RLS.
 */

export type ConnectorProvider = "manual_import" | "selfcare" | "cats" | "bank";
export type ConnectorStatus = "functional" | "demo" | "pending_integration" | "unavailable";
export type Capability = "sales_invoices" | "purchase_invoices" | "declarations" | "obligations" | "bank_statements";

export interface NormalizedInvoice {
  kind: "invoice";
  direction: "sale" | "purchase";
  type: "normal" | "corrective" | "cancelled" | "summary";
  number: string | null;
  nivf: string | null;
  nslf: string | null;
  issueDate: string; // ISO yyyy-mm-dd
  dueDate: string | null;
  counterpartyName: string | null;
  counterpartyNipt: string | null;
  currency: string;
  exchangeRate: string; // decimal si string
  subtotal: string;
  vatAmount: string;
  total: string;
  vatBreakdown: { rate: number; base: string; vat: string }[];
  paymentMethod: "cash" | "bank" | "card" | "compensation" | "other" | "unknown";
  raw: Record<string, unknown>;
}

export type NormalizedRecord = NormalizedInvoice;

export interface ConnectorHealth {
  status: ConnectorStatus;
  message: string;
  checkedAt: string;
}

export interface PullRequest {
  companyId: string;
  capability: Capability;
  period: { from: string; to: string };
  /** për manual_import: skedari i ngarkuar */
  file?: { name: string; bytes: Uint8Array; mime: string };
}

export interface Connector {
  readonly provider: ConnectorProvider;
  readonly status: ConnectorStatus;
  readonly capabilities: Capability[];
  test(companyId: string): Promise<ConnectorHealth>;
  pull(req: PullRequest): Promise<NormalizedRecord[]>;
}

/** Connector i papërfunduar: deklaron qartë statusin dhe refuzon çdo pull. */
export function pendingConnector(provider: ConnectorProvider, status: ConnectorStatus = "pending_integration"): Connector {
  return {
    provider,
    status,
    capabilities: [],
    async test() {
      return { status, message: "Në pritje të një metode të autorizuar integrimi nga DPT.", checkedAt: new Date().toISOString() };
    },
    async pull() {
      throw new Error(`Connector ${provider} është ${status}; përdor importin manual.`);
    },
  };
}

export const selfcareConnector = pendingConnector("selfcare");
export const catsConnector = pendingConnector("cats");
export const bankConnector = pendingConnector("bank", "unavailable");
// manualImportConnector (parsers Excel/CSV/XML) vjen në dorëzimin #5.
