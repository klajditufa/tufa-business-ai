import { CisInvoices } from "@/components/cis/cis-invoices";

/** Shitjet / Blerjet: moduli i faturave të cis-client-2 mbi certifikatën në shfletues dhe faturat e TUFA. */
export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { companyId } = await params;
  const sp = await searchParams;
  const purchases = sp.direction === "purchase";
  return (
    <CisInvoices
      key={purchases ? "purchases" : "sales"}
      kind={purchases ? "PURCHASES" : "SALES"}
      paymentsHref={`/app/${companyId}/invoices/payments?direction=${purchases ? "purchase" : "sale"}`}
    />
  );
}
