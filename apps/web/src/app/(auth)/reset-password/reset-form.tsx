"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionResult } from "@/server/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";

export function ResetForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="password">Fjalëkalimi i ri</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <Label htmlFor="confirm">Përsërit fjalëkalimin</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Duke ruajtur…" : "Ruaj fjalëkalimin"}
      </Button>
    </form>
  );
}
