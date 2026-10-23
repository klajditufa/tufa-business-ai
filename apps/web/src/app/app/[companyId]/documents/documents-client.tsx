"use client";

import { NativeSelect } from "@mantine/core";
import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconDownload as Download, IconFileDescription as FileText, IconTrash as Trash2, IconCloudUpload as UploadCloud } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { registerDocumentAction, getDocumentUrlAction, deleteDocumentAction, updateDocumentAction } from "@/server/actions/documents";
import { Badge, Button, Card, Empty, Input, Select } from "@/components/ui";
import { date } from "@/lib/format";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  category: string;
  file_name: string;
  title: string | null;
  mime: string;
  size_bytes: number;
  document_date: string | null;
  created_at: string;
  linked_type: string | null;
  linked_id: string | null;
  version: number;
};

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
  "text/csv", "text/xml", "application/xml", "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const MAX = 25 * 1024 * 1024;

async function sha256Hex(file: File) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsClient({
  companyId, docs, categories, activeCategory, search, canWrite,
}: {
  companyId: string; docs: Doc[]; categories: Record<string, string>; activeCategory: string; search: string; canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<string>(activeCategory || "other");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ name: string; status: "uploading" | "done" | "error"; msg?: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (files: FileList | File[]) => {
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const entry = { name: file.name, status: "uploading" as const };
      setProgress((p) => [entry, ...p]);
      const fail = (msg: string) => setProgress((p) => p.map((e) => (e === entry ? { ...e, status: "error", msg } : e)));
      if (file.size > MAX) { fail("Mbi 25 MB"); continue; }
      const mime = file.type || "application/octet-stream";
      if (!ALLOWED.includes(mime)) { fail(`Formati ${mime} nuk lejohet`); continue; }

      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `companies/${companyId}/${category}/${crypto.randomUUID()}.${ext}`;
      const [hash, up] = await Promise.all([
        sha256Hex(file),
        supabase.storage.from("documents").upload(path, file, { contentType: mime, upsert: false }),
      ]);
      if (up.error) { fail(up.error.message); continue; }

      const res = await registerDocumentAction({
        companyId, category: category as never, storagePath: path, fileName: file.name, mime, sizeBytes: file.size, sha256: hash,
      });
      if (!res.ok) { fail(res.error); continue; }
      setProgress((p) => p.map((e) => (e === entry ? { ...e, status: "done" } : e)));
    }
    startTransition(() => router.refresh());
  }, [companyId, category, router]);

  const open = async (id: string) => {
    const res = await getDocumentUrlAction(id);
    if (res.ok && res.url) window.open(res.url, "_blank", "noopener");
    else alert(res.ok ? "" : res.error);
  };

  const remove = async (id: string) => {
    if (!confirm("Ta heqësh këtë dokument nga arkiva?")) return;
    const res = await deleteDocumentAction(id);
    if (!res.ok) alert(res.error);
    startTransition(() => router.refresh());
  };

  const setFilter = (next: { category?: string; q?: string }) => {
    const sp = new URLSearchParams();
    const c = next.category ?? activeCategory; const q = next.q ?? search;
    if (c) sp.set("category", c); if (q) sp.set("q", q);
    router.push(`?${sp.toString()}`);
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <Card
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
          className={cn("border-2 border-dashed text-center transition", drag ? "border-accent bg-accent/5" : "border-border")}
        >
          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Tërhiq skedarët këtu ose</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
              {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>Zgjidh skedarët</Button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">PDF, foto, Excel, CSV, XML, Word · deri 25 MB · ruhen në arkivë private</p>
          {progress.length > 0 && (
            <ul className="mt-3 space-y-1 text-left text-xs">
              {progress.slice(0, 6).map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge tone={p.status === "done" ? "success" : p.status === "error" ? "danger" : "info"}>
                    {p.status === "done" ? "u ngarkua" : p.status === "error" ? "gabim" : "duke ngarkuar"}
                  </Badge>
                  <span className="truncate">{p.name}</span>
                  {p.msg && <span className="text-danger">{p.msg}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={activeCategory} onChange={(e) => setFilter({ category: e.target.value })} className="w-auto">
          <option value="">Të gjitha kategoritë</option>
          {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <form onSubmit={(e) => { e.preventDefault(); setFilter({ q: (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value }); }} className="flex gap-2">
          <Input name="q" defaultValue={search} placeholder="Kërko sipas emrit…" className="w-56" />
          <Button type="submit" variant="secondary">Kërko</Button>
        </form>
      </div>

      {docs.length === 0 ? (
        <Empty title="Ende pa dokumente në këtë kategori." hint="Ngarko NIPT-in, QKB-në, kontratat, ekstraktet bankare dhe faturat." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Dokumenti</th>
                <th className="px-4 py-2">Kategoria</th>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2 text-right">Madhësia</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <button onClick={() => open(doc.id)} className="flex items-center gap-2 text-left hover:underline">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{doc.title || doc.file_name}</span>
                    </button>
                    {doc.linked_type === "invoice" && <Badge tone="info" className="ml-6">faturë</Badge>}
                  </td>
                  <td className="px-4 py-2">
                    {canWrite ? (
                      <NativeSelect
                        size="xs"
                        aria-label="Kategoria"
                        defaultValue={doc.category}
                        onChange={async (e) => { await updateDocumentAction(doc.id, { category: e.currentTarget.value as never }); startTransition(() => router.refresh()); }}
                        data={Object.entries(categories).map(([value, label]) => ({ value, label }))}
                      />
                    ) : categories[doc.category]}
                  </td>
                  <td className="px-4 py-2 tabular">{date(doc.document_date ?? doc.created_at)}</td>
                  <td className="px-4 py-2 text-right tabular">{fmtSize(doc.size_bytes)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => open(doc.id)} aria-label="Shkarko"><Download className="h-4 w-4" /></Button>
                      {canWrite && <Button variant="ghost" size="sm" onClick={() => remove(doc.id)} aria-label="Fshi"><Trash2 className="h-4 w-4 text-danger" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {pending && <p className="text-xs text-muted-foreground">Duke rifreskuar…</p>}
    </div>
  );
}
