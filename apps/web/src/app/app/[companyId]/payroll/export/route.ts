import { NextResponse, type NextRequest } from "next/server";
import { getPayroll } from "@/server/services/payroll";
import { parsePeriod } from "@/components/app/month-picker";

/** GET …/payroll/export?period=YYYY-MM → CSV i listëpagesës (fushat e E-SIG 025), RLS aktive. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { year, month } = parsePeriod(request.nextUrl.searchParams.get("period") ?? undefined);
  const { run, lines } = await getPayroll(companyId, year, month);
  if (!run) return NextResponse.json({ error: "Listëpagesa nuk ekziston" }, { status: 404 });
  const n = (v: unknown) => String(Math.round(Number(v ?? 0)));
  const txt = (v: string | null | undefined) => {
    const s = v ?? "";
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const head = ["Nr. personal", "Mbiemri", "Emri", "Pozicioni", "Lloji", "Ditë pune", "Paga bruto", "Baza e kontributeve", "Sig. shoq. punëmarrës", "Sig. shoq. punëdhënës", "Sig. shënd. punëmarrës", "Sig. shënd. punëdhënës", "TAP", "Paga neto"];
  const rows = lines.map((l) => [
    txt(l.employees?.personal_no), txt(l.employees?.last_name), txt(l.employees?.first_name), txt(l.employees?.position),
    l.employees?.kind === "owner" ? "Pronar" : "Punonjës", l.days_worked, n(l.gross), n(l.social_base),
    n(l.social_employee), n(l.social_employer), n(l.health_employee), n(l.health_employer), n(l.income_tax), n(l.net),
  ].join(";"));
  const body = [head.join(";"), ...rows].join("\r\n");
  return new NextResponse("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="listepagesa-${year}-${String(month).padStart(2, "0")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
