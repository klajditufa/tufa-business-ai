"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const categories = ["invoice", "contract", "bank", "declaration", "customs", "employee", "business", "report", "other"] as const;

const registerSchema = z.object({
  companyId: z.string().uuid(),
  category: z.enum(categories),
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mime: z.string().min(1).max(120),
  sizeBytes: z.number().int().min(0).max(26214400),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  title: z.string().max(200).optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedType: z.enum(["invoice", "declaration", "obligation"]).optional(),
  linkedId: z.string().uuid().optional(),
});

export type DocumentInput = z.infer<typeof registerSchema>;

/**
 * Regjistron rreshtin në `documents` pasi skedari është ngarkuar në Storage nga klienti.
 * Nëse sha256 ekziston tashmë për këtë kompani, skedari i ri fshihet nga Storage dhe kthehet gabim "dublikatë".
 */
export async function registerDocumentAction(input: DocumentInput): Promise<ActionResult & { id?: string }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesioni ka skaduar." };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: d.companyId,
      category: d.category,
      storage_path: d.storagePath,
      file_name: d.fileName,
      mime: d.mime,
      size_bytes: d.sizeBytes,
      sha256: d.sha256 ?? null,
      title: d.title || d.fileName,
      document_date: d.documentDate ?? null,
      linked_type: d.linkedType ?? null,
      linked_id: d.linkedId ?? null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    // dublikatë → hiq skedarin e sapongarkuar
    await supabase.storage.from("documents").remove([d.storagePath]);
    if (error.code === "23505") return { ok: false, error: "Ky skedar ekziston tashmë në arkivë (përmbajtje identike)." };
    return { ok: false, error: error.message };
  }

  if (d.linkedType === "invoice" && d.linkedId) {
    await supabase.from("invoice_documents").insert({ invoice_id: d.linkedId, document_id: data.id, company_id: d.companyId });
  }

  revalidatePath(`/app/${d.companyId}/documents`);
  return { ok: true, id: data.id };
}

/** Signed URL 15 min për shkarkim/parapamje (RLS mbi storage.objects verifikon aksesin). */
export async function getDocumentUrlAction(documentId: string): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false, error: "Dokumenti nuk u gjet." };
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 900, { download: doc.file_name });
  if (error || !data) return { ok: false, error: error?.message ?? "Nuk u krijua linku." };
  return { ok: true, url: data.signedUrl };
}

export async function updateDocumentAction(
  documentId: string,
  patch: { category?: (typeof categories)[number]; title?: string; documentDate?: string | null },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("company_id").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false, error: "Dokumenti nuk u gjet." };
  const { error } = await supabase
    .from("documents")
    .update({
      ...(patch.category ? { category: patch.category } : {}),
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 200) } : {}),
      ...(patch.documentDate !== undefined ? { document_date: patch.documentDate } : {}),
    })
    .eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/${doc.company_id}/documents`);
  return { ok: true };
}

/** Soft delete: rreshti mbetet me deleted_at (audit), skedari mbetet në Storage deri në pastrimin periodik. */
export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("company_id").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false, error: "Dokumenti nuk u gjet." };
  const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/${doc.company_id}/documents`);
  return { ok: true };
}
