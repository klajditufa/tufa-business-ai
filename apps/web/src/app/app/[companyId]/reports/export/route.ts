import { NextResponse, type NextRequest } from "next/server";
import { getAnnualReport, parseYear } from "@/server/services/reports";

/** GET /app/[companyId]/reports/export?year= → CSV i raportit vjetor (me sesionin e përdoruesit, RLS aktive). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const year = parseYear(request.nextUrl.searchParams.get("year") ?? undefined);
  const { report, error } = await getAnnualReport(companyId, year);
  if (error || !report) return NextResponse.json({ error: error?.message ?? "Raporti nuk u gjet" }, { status: 400 });

  const n = (v: unknown) => (v == null ? "" : String(Number(v).toFixed(2)).replace(".", ","));
  // Tekst (emra nga faturat): thonjëza + mbrojtje nga formula injection; numrat nuk preken
  const txt = (v: string | null) => {
    const s = v ?? "";
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const lines = [
    ["Muaji", "Shitje nr.", "Shitje pa TVSH", "TVSH shitje", "Shitje totali", "Blerje nr.", "Blerje pa TVSH", "TVSH blerje", "Blerje totali", "Diferenca"].join(";"),
    ...report.months.map((m) =>
      [m.m.slice(0, 7), m.s_count, n(m.s_net), n(m.s_vat), n(m.s_total), m.p_count, n(m.p_net), n(m.p_vat), n(m.p_total), n(Number(m.s_net) - Number(m.p_net))].join(";"),
    ),
    [`Totali ${year}`, report.totals.s_count, n(report.totals.s_net), n(report.totals.s_vat), n(report.totals.s_total), report.totals.p_count, n(report.totals.p_net), n(report.totals.p_vat), n(report.totals.p_total), n(Number(report.totals.s_net) - Number(report.totals.p_net))].join(";"),
    "",
    "Klientët kryesorë;NIPT;Fatura;Pa TVSH",
    ...report.top_customers.map((c) => [txt(c.name), txt(c.nipt), c.invoices, n(c.net)].join(";")),
    "",
    "Furnitorët kryesorë;NIPT;Fatura;Pa TVSH",
    ...report.top_suppliers.map((c) => [txt(c.name), txt(c.nipt), c.invoices, n(c.net)].join(";")),
  ];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raporti-vjetor-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
