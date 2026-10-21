"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, X } from "lucide-react";
import { bulkSetStatusAction, type BulkItem, type BulkResult } from "@/server/actions/declarations";
import { Button } from "@/components/ui";

/**
 * "Deklaro të gjitha" për një kolonë të matricës: deklaron çdo subjekt të padeklaruar të atij lloji
 * dhe shfaq feedback për secilin (✓ deklaruar / ✗ gabim).
 */
export function BulkDeclare({ kindLabel, items, revalidate }: { kindLabel: string; items: BulkItem[]; revalidate: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [results, setResults] = useState<BulkResult[] | null>(null);

  const run = () => {
    if (items.length === 0) return;
    if (!confirm(`Të shënohen si "E Deklaruar" ${items.length} subjekte për ${kindLabel}?\n\nKjo nuk dorëzon asgjë në C@TS — vetëm regjistron statusin pasi i ke deklaruar.`)) return;
    start(async () => {
      const res = await bulkSetStatusAction(items, "declared", revalidate);
      setResults(res);
      router.refresh();
    });
  };

  const ok = results?.filter((r) => r.ok).length ?? 0;
  const bad = results?.filter((r) => !r.ok) ?? [];

  return (
    <div className="space-y-1">
      <Button size="sm" variant={items.length ? "primary" : "secondary"} disabled={pending || items.length === 0} onClick={run} className="h-7 text-xs">
        <CheckCheck className="h-3.5 w-3.5" /> {pending ? "Duke deklaruar…" : items.length ? `Deklaro të gjitha (${items.length})` : "Të gjitha deklaruar"}
      </Button>
      {results && (
        <div className="rounded-md border border-border bg-card p-2 text-xs normal-case tracking-normal">
          <div className="font-medium text-success">✓ {ok} deklaruar{bad.length ? ` · ✗ ${bad.length} me gabim` : ""}</div>
          {results.map((r) => (
            <div key={r.id} className={`flex items-start gap-1 ${r.ok ? "text-muted-foreground" : "text-danger"}`}>
              {r.ok ? <span>✓</span> : <X className="mt-0.5 h-3 w-3" />}
              <span>{r.label}{!r.ok && r.error ? ` — ${r.error}` : ""}</span>
            </div>
          ))}
          <button onClick={() => setResults(null)} className="mt-1 text-muted-foreground hover:underline">mbyll</button>
        </div>
      )}
    </div>
  );
}
