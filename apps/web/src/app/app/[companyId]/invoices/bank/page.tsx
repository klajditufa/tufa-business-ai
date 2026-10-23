import { Title } from "@mantine/core";
import Link from "next/link";
import { IconArrowLeft as ArrowLeft } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/server/services/companies";
import type { OpenInvoice } from "@/lib/bank-match";
import { BankReconcile } from "./bank-reconcile";

/**
 * Përputhja me ekstraktin bankar: faturat e papaguara (shitje + blerje) ngarkohen nga serveri,
 * ekstrakti lexohet në browser, dhe vetëm faturat e konfirmuara shënohen të paguara.
 */
export default async function BankPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();
  const [company, { data: rows }, { data: perms }] = await Promise.all([
    getCompany(companyId),
    supabase
      .from("invoices")
      .select("id, direction, number, issue_date, total, paid_amount, counterparty_name")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .neq("type", "cancelled")
      .in("payment_status", ["unpaid", "partial"])
      .gt("total", 0)
      .order("issue_date", { ascending: true })
      .limit(5000),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
  ]);
  const canWrite = (perms ?? []).some((p) => p.module === "invoices" && p.action === "write");
  const open: OpenInvoice[] = (rows ?? []).map((r) => ({
    id: r.id,
    direction: r.direction,
    number: r.number,
    issue_date: r.issue_date,
    outstanding: Math.round((Number(r.total) - Number(r.paid_amount ?? 0)) * 100) / 100,
    counterparty_name: r.counterparty_name,
  }));

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <Link href={`/app/${companyId}/invoices?direction=sale`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Faturat
      </Link>
      <div>
        <Title order={2} fz={{ base: 20, sm: 24 }}>Përputhja me bankën</Title>
        <p className="text-sm text-muted-foreground">
          Ngarko ekstraktin e llogarisë: arkëtimet lidhen me faturat e shitjes dhe pagesat me faturat e blerjes, sipas numrit të faturës në përshkrim, shumës dhe emrit.
          {" "}{open.filter((o) => o.direction === "sale").length} shitje dhe {open.filter((o) => o.direction === "purchase").length} blerje të papaguara.
        </p>
      </div>
      <BankReconcile companyId={companyId} open={open} currency={company?.base_currency ?? "ALL"} canWrite={canWrite} />
    </div>
  );
}
