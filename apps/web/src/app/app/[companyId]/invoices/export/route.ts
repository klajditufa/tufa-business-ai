import { NextResponse, type NextRequest } from "next/server";
import { listInvoices, parseInvoiceFilters } from "@/server/services/invoices";

/** GET /app/[companyId]/invoices/export?direction=&period=&q=&status=&source= → CSV (me sesionin e përdoruesit, RLS aktive). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const f = parseInvoiceFilters(sp);
  const { data, error } = await listInvoices(companyId, f, 20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const party = f.direction === "sale" ? "Klienti" : "Furnitori";
  const header = ["Data", "Nr. fature", party, "NIPT", "Pa TVSH", "TVSH", "Totali", "Monedha", "Tipi", "Pagesa", "Mënyra", "Burimi", "NIVF (FIC)", "NSLF (IIC)", "EIC"];
  const cell = (v: unknown) => {
    // Numrat (edhe negativët e faturave korrigjuese) dalin si numra, me presje dhjetore
    if (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v))) return String(v).replace(".", ",");
    const s = v == null ? "" : String(v);
    // Tekst: mbrojtje nga formula injection në Excel dhe quoting standard CSV
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [header.join(";")];
  for (const r of data ?? []) {
    lines.push(
      [r.issue_date, r.number, r.counterparty_name, r.counterparty_nipt, r.subtotal, r.vat_amount, r.total, r.currency, r.type, r.payment_status, r.payment_method, r.source, r.nivf, r.nslf, r.eic]
        .map(cell)
        .join(";"),
    );
  }
  const name = `${f.direction === "sale" ? "shitjet" : "blerjet"}-${f.period && f.period !== "all" ? f.period : "te-gjitha"}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
