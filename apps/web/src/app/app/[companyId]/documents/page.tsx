import { IconArchive as FolderArchive } from "@tabler/icons-react";
import { PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DocumentsClient } from "./documents-client";
import { t } from "@/lib/i18n";

const CATEGORY_LABELS: Record<string, string> = {
  invoice: "Fatura",
  contract: "Kontrata",
  bank: "Dokumente bankare",
  declaration: "Deklarata tatimore",
  customs: "Dokumente doganore",
  employee: "Dokumente punonjësish",
  business: "Dokumente të biznesit (NIPT, QKB)",
  report: "Raporte financiare",
  other: "Të tjera",
};

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { companyId } = await params;
  const { category, q } = await searchParams;
  const d = t();
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select("id, category, file_name, title, mime, size_bytes, document_date, created_at, linked_type, linked_id, version")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (category && category in CATEGORY_LABELS) query = query.eq("category", category as "invoice" | "contract" | "bank" | "declaration" | "customs" | "employee" | "business" | "report" | "other");
  if (q && q.trim()) query = query.or(`title.ilike.%${q.trim()}%,file_name.ilike.%${q.trim()}%`);

  const [{ data: docs, error }, { data: canWrite }] = await Promise.all([
    query,
    supabase.rpc("my_permissions", { p_company_id: companyId }),
  ]);
  const writable = (canWrite ?? []).some((p) => p.module === "documents" && p.action === "write");

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <PageTitle icon={FolderArchive} title={d.nav.documents} subtitle="Arkiva e sigurt e subjektit: QKB, NIPT, kontrata, vërtetime." />
      {error && <p className="text-sm text-danger">{error.message}</p>}
      <DocumentsClient
        companyId={companyId}
        docs={docs ?? []}
        categories={CATEGORY_LABELS}
        activeCategory={category ?? ""}
        search={q ?? ""}
        canWrite={writable}
      />
    </div>
  );
}
