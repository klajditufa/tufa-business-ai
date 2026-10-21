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
