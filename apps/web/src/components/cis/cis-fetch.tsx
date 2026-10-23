"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Checkbox, Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { IconAlertCircle, IconCircleCheck, IconCloudDownload } from "@tabler/icons-react";
import { CisFault, CisUnreachable, fetchDetails, fetchInvoices, type Kind } from "@/lib/cis/client";
import { FAULT_HINTS } from "@/lib/cis/parse";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { useCis } from "./cis-provider";

type Summary = { read: number; imported: number; updated: number; skipped: number; withItems: number; detailFailed: number; vat?: { registered: boolean; changed: boolean; asOf: string } };

const IMPORT_CHUNK = 100;

/**
 * "Merr nga CIS": lexon faturat e periudhës me certifikatën e këtij shfletuesi, i plotëson me artikujt
 * dhe i importon në TUFA (si "Merr faturat" i cis-client). Rifreskon faqen në fund.
 */
export function CisFetchButton({
  direction,
  from,
  to,
  disabled,
  onDone,
}: {
  direction: "sale" | "purchase";
  from: string | null;
  to: string | null;
  disabled?: boolean;
  /** Pas importit: p.sh. shfaq periudhën e marrë; përndryshe rifreskohet faqja. */
  onDone?: () => void;
}) {
  const { session, openDialog, company } = useCis();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [withItems, setWithItems] = useState(true);
  const [phase, setPhase] = useState<"idle" | "list" | "details" | "import" | "done" | "error">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const kind: Kind = direction === "sale" ? "SALES" : "PURCHASES";
  const busy = phase === "list" || phase === "details" || phase === "import";

  const start = async () => {
    if (!session || !from || !to) return;
    setOpened(true);
    setError(null);
    setSummary(null);
    setPhase("list");
    setProgress({ done: 0, total: 0 });
    try {
      let invoices = await fetchInvoices(session, kind, from, to, (p) => setProgress({ done: p.done, total: p.total }));
      let detailFailed = 0;
      if (withItems && invoices.length) {
        setPhase("details");
        setProgress({ done: 0, total: invoices.length });
        const r = await fetchDetails(session, kind, invoices, (p) => setProgress({ done: p.done, total: p.total }));
        invoices = r.invoices;
        detailFailed = r.failed;
      }
      setPhase("import");
      const totals: Summary = { read: invoices.length, imported: 0, updated: 0, skipped: 0, withItems: invoices.filter((i) => i.Items).length, detailFailed };
      const db = createClient();
      for (let i = 0; i < invoices.length; i += IMPORT_CHUNK) {
        setProgress({ done: i, total: invoices.length });
        const { data, error: rpcError } = await db.rpc("import_cis_invoices_user", {
          p_company_id: company.id,
          p_direction: direction,
          p_invoices: invoices.slice(i, i + IMPORT_CHUNK) as unknown as Json,
          p_label: `CIS ${kind.toLowerCase()} ${from}..${to}`,
        });
        if (rpcError) throw new Error(rpcError.message);
        const r = (data ?? {}) as { imported?: number; updated?: number; skipped?: number; vat_registered?: boolean; vat_changed?: boolean; vat_as_of?: string };
        if (typeof r.vat_registered === "boolean") {
          totals.vat = { registered: r.vat_registered, changed: !!r.vat_changed || !!totals.vat?.changed, asOf: r.vat_as_of ?? "" };
        }
        totals.imported += r.imported ?? 0;
        totals.updated += r.updated ?? 0;
        totals.skipped += r.skipped ?? 0;
      }
      setSummary(totals);
      setPhase("done");
      if (onDone) onDone();
      else router.refresh();
      // Kur ndryshon statusi i TVSH-së, rifreskohet edhe koka me skedat (layout-i).
      if (totals.vat?.changed) setTimeout(() => router.refresh(), 1500);
    } catch (e) {
      setPhase("error");
      if (e instanceof CisFault) setError({ message: e.message, hint: (e.code && FAULT_HINTS[e.code]) || undefined });
      else setError({ message: e instanceof CisUnreachable || e instanceof Error ? e.message : "Marrja dështoi." });
    }
  };

  const label = { idle: "", list: "Duke lexuar faturat nga CIS…", details: "Duke marrë artikujt e faturave…", import: "Duke i ruajtur në TUFA…", done: "", error: "" }[phase];
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 100;

  return (
    <>
      <Button
        variant="light"
        leftSection={<IconCloudDownload size={16} stroke={1.8} />}
        disabled={disabled || (!!session && (!from || !to))}
        loading={busy}
        onClick={() => (session ? void start() : openDialog())}
        w={{ base: "100%", sm: "auto" }}
      >
        Merr nga CIS
      </Button>
      <Modal opened={opened} onClose={() => !busy && setOpened(false)} title={`${direction === "sale" ? "Shitjet" : "Blerjet"} nga fiskalizimi`} closeOnClickOutside={!busy} withCloseButton={!busy}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {from?.split("-").reverse().join(".")} – {to?.split("-").reverse().join(".")} · {company.nipt}
          </Text>
          {busy && (
            <>
              <Text size="sm" fw={500}>
                {label} {phase !== "list" && progress.total ? `${progress.done} / ${progress.total}` : progress.done ? `${progress.done} fatura` : ""}
              </Text>
              <Progress value={phase === "list" ? 100 : pct} animated striped={phase === "list"} />
            </>
          )}
          {phase === "done" && summary && (
            <Alert color="teal" variant="light" icon={<IconCircleCheck size={18} />} title={`${summary.read} fatura nga CIS`}>
              {summary.imported} të reja, {summary.updated} të përditësuara{summary.skipped ? `, ${summary.skipped} të anashkaluara` : ""}.{" "}
              {summary.withItems} me artikuj{summary.detailFailed ? `; ${summary.detailFailed} pa artikuj (provo sërish më vonë)` : ""}.
              {summary.vat && (
                <Text size="sm" mt={6}>
                  Statusi i TVSH-së sipas fiskalizimit: <b>{summary.vat.registered ? "subjekt në TVSH" : "subjekt pa TVSH"}</b>
                  {summary.vat.asOf ? ` (fatura e ${summary.vat.asOf.split("-").reverse().join(".")})` : ""}
                  {summary.vat.changed ? " — u përditësua te subjekti." : "."}
                </Text>
              )}
            </Alert>
          )}
          {phase === "error" && error && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={error.message}>
              {error.hint}
            </Alert>
          )}
          {!busy && (
            <Group justify="space-between">
              <Checkbox checked={withItems} onChange={(e) => setWithItems(e.currentTarget.checked)} label="Me artikujt e faturave" />
              <Group gap="xs">
                <Button variant="default" onClick={() => setOpened(false)}>
                  Mbyll
                </Button>
                {phase !== "done" && <Button onClick={() => void start()}>Provo sërish</Button>}
              </Group>
            </Group>
          )}
        </Stack>
      </Modal>
    </>
  );
}
