"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCopy as Copy, IconKey as KeyRound, IconTrash as Trash2 } from "@tabler/icons-react";
import { createApiKeyAction, revokeApiKeyAction } from "@/server/actions/settings";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Badge, Button, Input, Label } from "@/components/ui";
import { date } from "@/lib/format";

type ApiKey = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

/**
 * Çelësat e agjentit lokal "TUFA Sync". Vlera e plotë shfaqet vetëm pas krijimit;
 * në DB ruhet vetëm hash-i, prandaj nuk mund të shfaqet më vonë.
 */
export function ApiKeysPanel({ companyId, keys, canAdmin, appUrl }: { companyId: string; keys: ApiKey[]; canAdmin: boolean; appUrl: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [state, action, pending] = useActionState<(ActionResult & { key?: string }) | null, FormData>(createApiKeyAction, null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };
  const active = keys.filter((k) => !k.revokedAt);
  const newKey = state && state.ok ? state.key : undefined;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Faturat e shitjes dhe blerjes lexohen nga sistemi i fiskalizimit (CIS) i DPT-së përmes agjentit <b>TUFA Sync</b>, që
        instalohet në kompjuterin e biznesit. Certifikata e fiskalizimit <b>mbetet gjithmonë në atë kompjuter</b>; në platformë
        dërgohen vetëm faturat, me çelësin API më poshtë.
      </p>

      {newKey && (
        <Alert tone="success">
          <div className="space-y-2">
            <div className="font-medium">Çelësi u krijua. Kopjoje tani — nuk do të shfaqet më:</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1 text-xs">{newKey}</code>
              <Button type="button" variant="secondary" size="sm" onClick={() => copy(newKey, "key")}>
                <Copy className="h-4 w-4" /> {copied === "key" ? "U kopjua" : "Kopjo"}
              </Button>
            </div>
            <div className="text-xs">
              Në kompjuterin e biznesit (Terminal, brenda dosjes <code>tufa-sync</code>):
              <pre className="mt-1 overflow-x-auto rounded bg-background p-2">{`export TUFA_URL=${appUrl}\nexport TUFA_API_KEY=${newKey}\n./start.sh push --cert certifikata.p12 --from 2026-01-01 --to 2026-12-31`}</pre>
            </div>
          </div>
        </Alert>
      )}

      <ul className="divide-y divide-border text-sm">
        {active.length === 0 && <li className="py-2 text-muted-foreground">Asnjë çelës aktiv.</li>}
        {active.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <div>
                <div>{k.name}</div>
                <div className="text-xs text-muted-foreground">
                  <code>{k.prefix}…</code> · krijuar {date(k.createdAt)} · {k.lastUsedAt ? `përdorur ${date(k.lastUsedAt)}` : "ende i papërdorur"}
                </div>
              </div>
            </div>
            {canAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!confirm(`Revokon çelësin "${k.name}"? Agjenti që e përdor do të ndalojë së sinkronizuari.`)) return;
                  start(async () => {
                    await revokeApiKeyAction(companyId, k.id);
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="h-4 w-4" /> Revoko
              </Button>
            )}
          </li>
        ))}
      </ul>
      {keys.some((k) => k.revokedAt) && (
        <p className="text-xs text-muted-foreground">
          Të revokuar: {keys.filter((k) => k.revokedAt).map((k) => k.name).join(", ")}
        </p>
      )}

      {canAdmin && (
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="companyId" value={companyId} />
          <div className="flex-1">
            <Label htmlFor="apikey-name">Çelës i ri (emri i kompjuterit)</Label>
            <Input id="apikey-name" name="name" placeholder="p.sh. Kompjuteri i zyrës" required minLength={2} />
          </div>
          <Button type="submit" disabled={pending}>
            <KeyRound className="h-4 w-4" /> {pending ? "Duke krijuar…" : "Krijo çelës"}
          </Button>
        </form>
      )}
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <p className="text-xs text-muted-foreground">
        Një çelës jep të drejtë vetëm të <b>dërgojë fatura (nga fiskalizimi) dhe listëpagesa (nga e-Filing) për këtë subjekt</b> — asgjë tjetër. Nëse dyshon se ka rrjedhur, revokoje dhe krijo një të ri.
      </p>
      <Badge tone="info">Agjenti: tufa-sync (open source, Python) — shkarkohet nga GitHub</Badge>
    </div>
  );
}
