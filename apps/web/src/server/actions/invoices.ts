"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  companyId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(1000),
  status: z.enum(["paid", "unpaid"]),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  method: z.enum(["cash", "bank", "card", "compensation", "other"]).optional(),
});

export type PaymentResult = { ok: boolean; updated: number; failed: { id: string; error: string }[]; error?: string };

/** Shënon faturat e zgjedhura të paguara / të papaguara (RPC set_invoices_payment, me kontroll të drejte për çdo faturë). */
export async function setInvoicesPaymentAction(input: z.input<typeof schema>): Promise<PaymentResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, updated: 0, failed: [], error: "Të dhëna të pavlefshme." };
  const { companyId, ids, status, paidAt, method } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_invoices_payment", {
    p_ids: ids,
    p_status: status,
    p_paid_at: paidAt,
    p_method: method,
  });
  if (error) return { ok: false, updated: 0, failed: [], error: error.message };
  const rows = data ?? [];
  revalidatePath(`/app/${companyId}/invoices`);
  revalidatePath(`/app/${companyId}/dashboard`);
  return {
    ok: rows.every((r) => r.ok),
    updated: rows.filter((r) => r.ok).length,
    failed: rows.filter((r) => !r.ok).map((r) => ({ id: r.id, error: r.error ?? "" })),
  };
}
