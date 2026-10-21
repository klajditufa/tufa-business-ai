"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ActionResult } from "@/server/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(forgotPasswordAction, null);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Duke dërguar…" : "Dërgo linkun"}
      </Button>
    </form>
  );
}
