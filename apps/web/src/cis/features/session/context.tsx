"use client";

/*
 * Përshtatësi i TUFA për modulin e faturave të cis-client-2.
 *
 * Te cis-client, pamjet thërrasin serverin lokal (`/api/v1/utilities/...`) që nënshkruan me certifikatën.
 * Këtu e njëjta `call()` përgjigjet nga:
 *   - CIS, me certifikatën e ruajtur në këtë shfletues (nënshkrim në shfletues, përcjellje nga /api/cis);
 *     çdo gjë e marrë ruhet edhe në TUFA (import_cis_invoices_user), me artikujt kur janë marrë;
 *   - databaza e TUFA, kur nuk ka certifikatë (ose kur kërkohet shprehimisht `Source: "db"`).
 * Kështu pamjet e cis-client mbeten të pandryshuara.
 */
import { createContext, useCallback, useContext, useRef } from "react";
import { ApiError, API, invoicesPath } from "../../api";
import type { Business, CertificateBusiness, Invoice, Kind } from "../../types";
import { CisFault, CisUnreachable, fetchByFic, fetchEinvoicePdf, fetchInvoices, type CisSession } from "@/lib/cis/client";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

/** Biznesi që tregon pamja (në TUFA: subjekti aktiv). */
export const BusinessContext = createContext<Business | null>(null);

export function useBusiness(): Business {
  const business = useContext(BusinessContext);
  if (!business) throw new Error("useBusiness needs BusinessContext");
  return business;
}

/** Në TUFA pamjet punojnë edhe pa certifikatë (nga databaza), prandaj biznesi kthehet gjithmonë. */
export function useCertificateBusiness(): CertificateBusiness {
  return useBusiness() as CertificateBusiness;
}

export const businessName = (business: Business): string => business.name || business.nipt || business.id;

export type TufaCis = { companyId: string; nipt: string; session: CisSession | null; onCisMissing: () => void };
export const TufaCisContext = createContext<TufaCis | null>(null);

export type ApiCall = <T>(path: string, body?: unknown) => Promise<T>;

const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof CisFault) return new ApiError(500, { message: error.message, cisError: { faultEnv: error.faultCode, faultString: error.message, faultCode: error.code } });
  if (error instanceof CisUnreachable) return new ApiError(503, { message: error.message, unreachable: true });
  return new ApiError(500, { message: error instanceof Error ? error.message : String(error) });
};

type Row = {
  raw: Json | null; nivf: string | null; nslf: string | null; eic: string | null; number: string | null; issue_date: string;
  counterparty_name: string | null; counterparty_nipt: string | null; subtotal: number; vat_amount: number; total: number; is_einvoice: boolean | null;
};

/** Fatura nga TUFA në formën e CIS: `raw` kur vjen nga fiskalizimi, përndryshe e ndërtuar nga kolonat. */
function rowToInvoice(row: Row, kind: Kind, own: { nipt: string; name: string }): Invoice {
  if (row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)) return row.raw as unknown as Invoice;
  const party = { IDNum: row.counterparty_nipt ?? undefined, Name: row.counterparty_name ?? undefined };
  const self = { IDNum: own.nipt, Name: own.name };
  return {
    IssueDateTime: row.issue_date,
    InvNum: row.number ?? undefined,
    TotPriceWoVAT: String(row.subtotal),
    TotVATAmt: String(row.vat_amount),
    TotPrice: String(row.total),
    FIC: row.nivf ?? undefined,
    IIC: row.nslf ?? undefined,
    EIC: row.eic ?? undefined,
    IsEinvoice: row.is_einvoice == null ? undefined : String(row.is_einvoice),
    Seller: kind === "SALES" ? self : party,
    Buyer: kind === "SALES" ? party : self,
  } as unknown as Invoice;
}

const COLUMNS = "raw, nivf, nslf, eic, number, issue_date, counterparty_name, counterparty_nipt, subtotal, vat_amount, total, is_einvoice";

/** POST "te serveri" i cis-client, i përgjigjur nga CIS (me certifikatë) ose nga TUFA. */
export function useApi(): ApiCall {
  const business = useBusiness();
  const tufa = useContext(TufaCisContext);
  if (!tufa) throw new Error("useApi needs TufaCisContext");
  const { companyId, session, nipt } = tufa;
  // Faturat e plota (me artikuj) ruhen në TUFA me grupe, pa e ndalur ngarkimin.
  const queue = useRef<Map<Kind, Invoice[]>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (kind: Kind, invoices: Invoice[]) => {
      const db = createClient();
      for (let i = 0; i < invoices.length; i += 100) {
        const { error } = await db.rpc("import_cis_invoices_user", {
          p_company_id: companyId,
          p_direction: kind === "SALES" ? "sale" : "purchase",
          p_invoices: invoices.slice(i, i + 100) as unknown as Json,
          p_label: "CIS (TUFA)",
        });
        if (error) throw new ApiError(500, { message: `Faturat u morën nga CIS, por nuk u ruajtën në TUFA: ${error.message}` });
      }
    },
    [companyId],
  );

  const enqueue = useCallback(
    (kind: Kind, invoice: Invoice) => {
      const list = queue.current.get(kind) ?? [];
      list.push(invoice);
      queue.current.set(kind, list);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        for (const [k, items] of queue.current) {
          queue.current.set(k, []);
          if (items.length) void save(k, items).catch(() => {});
        }
      }, 1500);
    },
    [save],
  );

  return useCallback(
    async <T,>(path: string, body: unknown = {}): Promise<T> => {
      const args = (body ?? {}) as Record<string, unknown>;
      const kind: Kind | null = path === invoicesPath("SALES") ? "SALES" : path === invoicesPath("PURCHASES") ? "PURCHASES" : null;
      const own = { nipt, name: business.name ?? nipt };
      const useCis = session && args.Source !== "db";
      try {
        if (kind && typeof args.FIC === "string") {
          const fic = args.FIC.trim();
          if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(fic)) {
            throw new ApiError(400, { message: "NIVF (FIC) duhet të jetë si 2ed48eff-f3d0-4315-a2a5-16618c63ad0b", field: "FIC" });
          }
          if (useCis) {
            const found = await fetchByFic(session, kind, fic);
            if (found) enqueue(kind, found as unknown as Invoice);
            return (found ? [found] : []) as T;
          }
          const { data, error } = await createClient()
            .from("invoices")
            .select(COLUMNS)
            .eq("company_id", companyId)
            .eq("direction", kind === "SALES" ? "sale" : "purchase")
            .ilike("nivf", fic)
            .is("deleted_at", null)
            .limit(1);
          if (error) throw new ApiError(500, { message: error.message });
          const invoice = data?.[0] ? rowToInvoice(data[0] as Row, kind, own) : null;
          if (invoice && args.Details !== false && !invoice.Items?.length && !useCis) {
            // Pa certifikatë artikujt nuk mund të merren: fatura kthehet siç është në TUFA.
            tufa.onCisMissing();
          }
          return (invoice ? [invoice] : []) as T;
        }
        if (kind && typeof args.FromDate === "string" && typeof args.ToDate === "string") {
          if (useCis) {
            const invoices = (await fetchInvoices(session, kind, args.FromDate, args.ToDate)) as unknown as Invoice[];
            await save(kind, invoices);
            return invoices as T;
          }
          const all: Invoice[] = [];
          for (let page = 0; ; page++) {
            const { data, error } = await createClient()
              .from("invoices")
              .select(COLUMNS)
              .eq("company_id", companyId)
              .eq("direction", kind === "SALES" ? "sale" : "purchase")
              .is("deleted_at", null)
              .gte("issue_date", args.FromDate)
              .lte("issue_date", args.ToDate)
              .order("issue_date", { ascending: false })
              .range(page * 1000, page * 1000 + 999);
            if (error) throw new ApiError(500, { message: error.message });
            all.push(...(data ?? []).map((r) => rowToInvoice(r as Row, kind, own)));
            if (!data || data.length < 1000) break;
          }
          return all as T;
        }
        if (path === `${API}/einvoice-pdf` && typeof args.EIC === "string") {
          if (!session) {
            tufa.onCisMissing();
            throw new ApiError(400, { message: "PDF-ja zyrtare merret nga CIS: shto certifikatën e subjektit." });
          }
          const base64 = await fetchEinvoicePdf(session, args.EIC, args.PartyType === "SELLER" ? "SELLER" : "BUYER");
          if (!base64) throw new ApiError(404, { message: "CIS nuk ka PDF për këtë e-faturë." });
          return { base64 } as T;
        }
        throw new ApiError(404, { message: "Veprim i panjohur" });
      } catch (error) {
        throw toApiError(error);
      }
    },
    [business.name, companyId, enqueue, nipt, save, session, tufa],
  );
}
