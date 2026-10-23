import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCompany } from "@/server/services/companies";
import { getPartyLedger } from "@/server/services/parties";
import { Card, CardTitle } from "@/components/ui";
import { date, money } from "@/lib/format";

/** Kartela e klientit / furnitorit: faturat dhe pagesat me gjendje progresive. */
export default async function PartyLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; partyId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { companyId, partyId } = await params;
  const { type } = await searchParams;
  const direction = type === "suppliers" ? "purchase" : "sale";
  const [company, { party, entries, invoices, error }] = await Promise.all([getCompany(companyId), getPartyLedger(companyId, direction, partyId)]);
  if (!party) notFound();
  const currency = company?.base_currency ?? "ALL";
  const debit = entries.reduce((a, e) => a + e.debit, 0);
  const credit = entries.reduce((a, e) => a + e.credit, 0);
  const balance = entries.at(-1)?.balance ?? 0;
  const unpaid = invoices.filter((i) => i.payment_status !== "paid" && Number(i.total) > 0);
  const typeParam = direction === "sale" ? "customers" : "suppliers";

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <Link href={`/app/${companyId}/parties?type=${typeParam}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> {direction === "sale" ? "Klientët" : "Furnitorët"}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{party.name}</h1>
        <p className="text-sm text-muted-foreground">
          {party.nipt && <span className="font-mono">{party.nipt}</span>}
          {party.address && <> · {party.address}</>}
          {party.email && <> · {party.email}</>}
          {party.phone && <> · {party.phone}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Fatura</div><div className="text-lg font-semibold tabular">{invoices.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Faturuar</div><div className="text-lg font-semibold tabular">{money(debit, currency)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Paguar / kredituar</div><div className="text-lg font-semibold tabular">{money(credit, currency)}</div></Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{direction === "sale" ? "Na detyrohet" : "I detyrohemi"}</div>
          <div className={`text-lg font-semibold tabular ${balance > 0.009 ? "text-warning" : "text-success"}`}>{money(balance, currency)}</div>
        </Card>
      </div>

      {error && <p className="text-sm text-danger">{error.message}</p>}

      <Card className="overflow-x-auto p-0">
        <div className="px-4 py-3"><CardTitle>Kartela</CardTitle></div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Përshkrimi</th>
              <th className="px-4 py-2 text-right">Debi</th>
              <th className="px-4 py-2 text-right">Kredi</th>
              <th className="px-4 py-2 text-right">Gjendja</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.invoiceId}-${e.kind}-${i}`} className={`border-t border-border ${e.kind === "payment" ? "text-muted-foreground" : ""}`}>
                <td className="whitespace-nowrap px-4 py-2 tabular">{date(e.date)}</td>
                <td className="px-4 py-2">{e.label}</td>
                <td className="px-4 py-2 text-right tabular">{e.debit ? money(e.debit, currency) : ""}</td>
                <td className="px-4 py-2 text-right tabular">{e.credit ? money(e.credit, currency) : ""}</td>
                <td className="px-4 py-2 text-right font-medium tabular">{money(e.balance, currency)}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-muted-foreground">Asnjë lëvizje.</td></tr>}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/50 text-xs font-medium">
            <tr>
              <td className="px-4 py-2" colSpan={2}>Totali</td>
              <td className="px-4 py-2 text-right tabular">{money(debit, currency)}</td>
              <td className="px-4 py-2 text-right tabular">{money(credit, currency)}</td>
              <td className="px-4 py-2 text-right tabular">{money(balance, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {unpaid.length > 0 && (
        <p className="text-sm">
          {unpaid.length} fatura të papaguara.{" "}
          <Link
            href={`/app/${companyId}/invoices?direction=${direction}&period=all&status=unpaid&q=${encodeURIComponent(party.nipt ?? party.name)}`}
            className="text-accent hover:underline"
          >
            Hapi te regjistri për t&apos;i shënuar të paguara →
          </Link>
        </p>
      )}
    </div>
  );
}
