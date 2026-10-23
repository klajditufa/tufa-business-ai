"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCopy as Copy, IconTrash as Trash2, IconUserPlus as UserPlus } from "@tabler/icons-react";
import { inviteUserAction, removeMemberAction, revokeInvitationAction } from "@/server/actions/settings";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Badge, Button, Input, Label, Select } from "@/components/ui";
import { date } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  accountant: "Kontabilist",
  company_admin: "Administrator i subjektit",
  finance_manager: "Menaxher finance",
  operator: "Operator",
  viewer: "Vëzhgues",
  org_owner: "Pronar i organizatës",
};

type Member = { userId: string; role: string; name: string; email: string };
type Invitation = { id: string; email: string; role: string; expiresAt: string };

export function MembersPanel({
  companyId, members, invitations, canAdmin, myUserId, ownerName,
}: { companyId: string; members: Member[]; invitations: Invitation[]; canAdmin: boolean; myUserId: string; ownerName: string | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [state, action, pending] = useActionState<(ActionResult & { link?: string }) | null, FormData>(inviteUserAction, null);
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-border text-sm">
        {ownerName && (
          <li className="flex items-center justify-between py-2">
            <span>{ownerName}</span>
            <Badge tone="info">{ROLE_LABELS.org_owner}</Badge>
          </li>
        )}
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
            <div>
              <div>{m.name || m.email}</div>
              {m.name && <div className="text-xs text-muted-foreground">{m.email}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge>{ROLE_LABELS[m.role] ?? m.role}</Badge>
              {canAdmin && m.userId !== myUserId && (
                <button
                  onClick={() => { if (confirm(`Ta heqësh ${m.email} nga ky subjekt?`)) start(async () => { await removeMemberAction(companyId, m.userId); router.refresh(); }); }}
                  className="text-danger hover:opacity-80" aria-label="Hiq"
                ><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          </li>
        ))}
        {members.length === 0 && !ownerName && <li className="py-2 text-muted-foreground">Asnjë përdorues tjetër.</li>}
      </ul>

      {invitations.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Ftesa në pritje</div>
          <ul className="divide-y divide-border text-sm">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div>{i.email} <span className="text-xs text-muted-foreground">· skadon {date(i.expiresAt)}</span></div>
                <div className="flex items-center gap-2">
                  <Badge tone="warning">{ROLE_LABELS[i.role] ?? i.role}</Badge>
                  {canAdmin && (
                    <button onClick={() => start(async () => { await revokeInvitationAction(i.id, companyId); router.refresh(); })} className="text-danger" aria-label="Anulo"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canAdmin && (
        <form action={action} className="rounded-lg border border-border p-4">
          <input type="hidden" name="companyId" value={companyId} />
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><UserPlus className="h-4 w-4" /> Fto një përdorues</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div><Label htmlFor="inv-email">Email</Label><Input id="inv-email" name="email" type="email" required placeholder="emri@biznesi.al" /></div>
            <div><Label htmlFor="inv-role">Roli</Label>
              <Select id="inv-role" name="role" defaultValue="company_admin">
                {["accountant", "company_admin", "finance_manager", "operator", "viewer"].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select></div>
            <div className="self-end"><Button type="submit" disabled={pending}>{pending ? "…" : "Krijo ftesën"}</Button></div>
          </div>
          {state && !state.ok && <Alert tone="danger" className="mt-3">{state.error}</Alert>}
          {state?.ok && state.link && (
            <Alert tone="success" className="mt-3">
              <div>{state.message}</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-card px-2 py-1 text-xs">{state.link}</code>
                <Button type="button" size="sm" variant="secondary" onClick={() => copy(state.link!)}><Copy className="h-3.5 w-3.5" /> {copied ? "U kopjua" : "Kopjo"}</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Linku vlen 7 ditë dhe funksionon vetëm për këtë email. Dërgimi automatik me email vjen në Fazën 2.</p>
            </Alert>
          )}
        </form>
      )}
    </div>
  );
}
