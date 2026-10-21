"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const statusSchema = z.enum(["pending", "in_process", "for_review", "suspended", "declared"]);
export type SettableStatus = z.infer<typeof statusSchema>;

export async function setDeclarationStatusAction(
  declarationId: string,
  status: SettableStatus,
  notes?: string,
  revalidate?: string,
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success || !z.string().uuid().safeParse(declarationId).success) return { ok: false, error: "Të dhëna të pavlefshme." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_declaration_status", {
    p_id: declarationId,
    p_status: parsed.data,
    p_notes: notes ?? undefined,
  });
  if (error) return { ok: false, error: error.code === "42501" ? "Nuk ke të drejtë të ndryshosh statusin." : error.message };
  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}

export type BulkItem = { id: string; label: string };
export type BulkResult = { id: string; label: string; ok: boolean; error?: string };

/**
 * Deklarim masiv: thërret set_declaration_status për çdo id veç e veç (RLS + leje per subjekt),
 * dhe kthen rezultatin për secilin — asnjë dështim nuk ndal të tjerët.
 */
export async function bulkSetStatusAction(items: BulkItem[], status: SettableStatus, revalidate?: string): Promise<BulkResult[]> {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success || !Array.isArray(items) || items.length === 0 || items.length > 500) return [];
  const supabase = await createClient();
  const results: BulkResult[] = [];
  for (const it of items) {
    if (!z.string().uuid().safeParse(it.id).success) { results.push({ id: it.id, label: it.label, ok: false, error: "id i pavlefshëm" }); continue; }
    const { error } = await supabase.rpc("set_declaration_status", { p_id: it.id, p_status: parsed.data, p_notes: undefined });
    results.push({
      id: it.id,
      label: it.label,
      ok: !error,
      error: error ? (error.code === "42501" ? "pa të drejtë për këtë subjekt" : error.message) : undefined,
    });
  }
  if (revalidate) revalidatePath(revalidate);
  return results;
}
