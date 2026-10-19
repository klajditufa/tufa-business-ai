"use client";

import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/server/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";
import { t } from "@/lib/i18n";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);
  const d = t();
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <Label htmlFor="email">{d.auth.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">{d.auth.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
      </div>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? d.common.loading : d.auth.login}
      </Button>
    </form>
  );
}
