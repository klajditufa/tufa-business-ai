"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil } from "lucide-react";
import { confirmTaxRuleAction, editTaxRuleAction } from "@/server/actions/tax-rules";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";

type Params = Record<string, unknown>;

/** Veprimet për një rregull: Konfirmo · Ndrysho (korrigjim ose vlerë e re nga një datë). */
export function RuleEditor({ id, params, source, confirmed, current }: { id: string; params: Params; source: string | null; confirmed: boolean; current: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"correct" | "supersede">("supersede");
  const [values, setValues] = useState<Params>(params);
  const [pending, start] = useTransition();
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [state, action, saving] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const r = await editTaxRuleAction(prev, fd);
    if (r.ok) { setOpen(false); router.refresh(); }
    return r;
  }, null);

  const scalarKeys = Object.keys(params).filter((k) => typeof params[k] !== "object" || params[k] === null);
  const complexKeys = Object.keys(params).filter((k) => typeof params[k] === "object" && params[k] !== null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!confirmed && (
          <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => {
            const r = await confirmTaxRuleAction(id);
            setConfirmMsg(r.ok ? null : r.error);
            router.refresh();
          })}>
            <CheckCircle2 className="h-4 w-4" /> Konfirmo
          </Button>
        )}
        {current && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
            <Pencil className="h-4 w-4" /> Ndrysho
          </Button>
        )}
      </div>
      {confirmMsg && <Alert tone="danger">{confirmMsg}</Alert>}

      {open && (
        <form action={action} className="space-y-3 rounded-lg border border-border p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="params" value={JSON.stringify(values)} />
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === "supersede"} onChange={() => setMode("supersede")} /> Ndryshim ligjor nga një datë (ruan historinë)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === "correct"} onChange={() => setMode("correct")} /> Korrigjim gabimi (zëvendëson vlerën)
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {scalarKeys.map((k) => (
              <div key={k} className={k === "label" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`${id}-${k}`}>{k}</Label>
                <Input
                  id={`${id}-${k}`}
                  value={String(values[k] ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw.trim() !== "" && !Number.isNaN(Number(raw)) && typeof params[k] === "number" ? Number(raw) : raw;
                    setValues((v) => ({ ...v, [k]: num }));
                  }}
                />
              </div>
            ))}
            {complexKeys.map((k) => (
              <div key={k} className="sm:col-span-2">
                <Label htmlFor={`${id}-${k}`}>{k} (JSON)</Label>
                <textarea
                  id={`${id}-${k}`}
                  className="h-40 w-full rounded-lg border border-border bg-background p-2 font-mono text-xs"
                  defaultValue={JSON.stringify(params[k], null, 2)}
                  onChange={(e) => {
                    try { setValues((v) => ({ ...v, [k]: JSON.parse(e.target.value) })); } catch { /* pritet JSON i plotë */ }
                  }}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {mode === "supersede" && (
              <div>
                <Label htmlFor={`${id}-from`}>Në fuqi nga data</Label>
                <Input id={`${id}-from`} name="validFrom" type="date" required />
              </div>
            )}
            <div className={mode === "supersede" ? "" : "sm:col-span-2"}>
              <Label htmlFor={`${id}-src`}>Burimi ligjor</Label>
              <Input id={`${id}-src`} name="source" defaultValue={mode === "correct" ? source ?? "" : ""} placeholder="p.sh. VKM nr. …/2026" required={mode === "supersede"} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Duke ruajtur…" : "Ruaj"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Anulo</Button>
          </div>
          {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
        </form>
      )}
      {state?.ok && !open && <Alert tone="success">{state.message}</Alert>}
    </div>
  );
}
