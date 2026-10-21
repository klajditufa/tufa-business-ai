import Link from "next/link";
import { listMyCompanies } from "@/server/services/companies";
import { Badge, Card } from "@/components/ui";
import { t } from "@/lib/i18n";

export default async function StudioCompaniesPage() {
  const companies = await listMyCompanies();
  const d = t();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Subjektet ({companies.length})</h1>
        <Link href="/studio/companies/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">+ Subjekt i ri</Link>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Emri</th><th className="px-4 py-2">NIPT</th><th className="px-4 py-2">Forma</th><th className="px-4 py-2">Regjimi</th><th className="px-4 py-2">TVSH</th><th className="px-4 py-2">Qyteti</th></tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2"><Link href={`/app/${c.id}/dashboard`} className="font-medium hover:underline">{c.trade_name || c.legal_name}</Link></td>
                <td className="px-4 py-2 font-mono text-xs">{c.nipt}</td>
                <td className="px-4 py-2">{d.legalForms[c.legal_form]}</td>
                <td className="px-4 py-2">{d.taxRegimes[c.tax_regime]}</td>
                <td className="px-4 py-2"><Badge tone={c.vat_registered ? "info" : "neutral"}>{c.vat_registered ? "Po" : "Jo"}</Badge></td>
                <td className="px-4 py-2">{c.city ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
