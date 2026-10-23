"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Group } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { CisFault, registry } from "@/lib/cis/client";
import { FAULT_HINTS } from "@/lib/cis/parse";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { useCis } from "./cis-provider";

/** Rifreskon njësitë, pajisjet dhe operatorët nga CIS me certifikatën e këtij shfletuesi. */
export function RegistryRefresh() {
  const { session, openDialog, company } = useCis();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (!session) return openDialog();
    setBusy(true);
    setError(null);
    try {
      const db = createClient();
      for (const kind of ["units", "tcrs", "operators"] as const) {
        const rows = await registry[kind](session);
        const { error: e } = await db.rpc("set_company_registry", { p_company_id: company.id, p_kind: kind, p_rows: rows as unknown as Json });
        if (e) throw new Error(e.message);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof CisFault ? `${e.message}${e.code && FAULT_HINTS[e.code] ? ` — ${FAULT_HINTS[e.code]}` : ""}` : e instanceof Error ? e.message : "Rifreskimi dështoi.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Group gap="sm">
      <Button variant="light" leftSection={<IconRefresh size={16} stroke={1.8} />} loading={busy} onClick={() => void run()}>
        {session ? "Rifresko nga CIS" : "Shto certifikatën CIS"}
      </Button>
      {error && (
        <Alert color="red" variant="light" py={6}>
          {error}
        </Alert>
      )}
    </Group>
  );
}
