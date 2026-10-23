"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, PasswordInput, SegmentedControl, Stack, Text, ThemeIcon } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconAlertCircle, IconCertificate, IconFileCertificate, IconLock } from "@tabler/icons-react";
import { CertificateError, importSigningKey, openPkcs12, signWith } from "@/lib/cis/cert";
import { CisFault, CisUnreachable, registry } from "@/lib/cis/client";
import { FAULT_HINTS } from "@/lib/cis/parse";
import { saveCertificate } from "@/lib/cis/store";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { useCis } from "./cis-provider";

/**
 * Shto certifikatën e fiskalizimit (si SetupForm i cis-client): skedari .p12/.pfx dhe fjalëkalimi.
 * Certifikata hapet në këtë shfletues; çelësi privat ruhet si çelës i pa-eksportueshëm dhe nuk dërgohet
 * askund. Pas hapjes, një kërkesë GetTCRs te CIS konfirmon që certifikata pranohet.
 */
export function CertificateDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { company, setCertificate } = useCis();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [environment, setEnvironment] = useState<"production" | "test" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const reset = () => {
    setFile(null);
    setPassword("");
    setEnvironment(null);
    setError(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!file) return setError({ message: "Zgjidh skedarin e certifikatës (.p12 ose .pfx)." });
    setBusy(true);
    setError(null);
    try {
      const { info, pkcs8 } = openPkcs12(await file.arrayBuffer(), password);
      if (!info.nipt) throw new CertificateError("Certifikata nuk ka NIPT; CIS nuk e pranon.");
      if (info.nipt !== company.nipt.toUpperCase()) {
        throw new CertificateError(`Kjo certifikatë është për NIPT ${info.nipt}, jo për ${company.nipt}. Zgjidh subjektin e duhur.`);
      }
      if (info.expired) throw new CertificateError(`Certifikata ka skaduar më ${info.validTo.slice(0, 10).split("-").reverse().join(".")}.`);
      const key = await importSigningKey(pkcs8);
      const env = environment ?? info.environment;
      const stored = { nipt: info.nipt, info: { ...info, environment: env }, key, savedAt: new Date().toISOString(), persisted: remember };
      // Konfirmimi me CIS (si cis-client): pajisjet e subjektit; ruhen edhe te regjistrat.
      const tcrs = await registry.tcrs({ companyId: company.id, environment: env, signer: { sign: signWith(key), certificateB64: info.certificateB64 } });
      await createClient().rpc("set_company_registry", { p_company_id: company.id, p_kind: "tcrs", p_rows: tcrs as unknown as Json });
      await saveCertificate(stored);
      setCertificate(stored);
      close();
    } catch (e) {
      setBusy(false);
      if (e instanceof CisFault) setError({ message: e.message, hint: (e.code && FAULT_HINTS[e.code]) || undefined });
      else if (e instanceof CertificateError || e instanceof CisUnreachable) setError({ message: e.message });
      else setError({ message: e instanceof Error ? e.message : "Certifikata nuk u hap." });
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={`Certifikata e fiskalizimit · ${company.name}`} size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Ngarko certifikatën .p12 të subjektit {company.nipt} dhe fjalëkalimin e saj. TUFA i merr shitjet, blerjet, artikujt dhe regjistrat direkt nga
          fiskalizimi (CIS).
        </Text>
        <Dropzone
          onDrop={(files) => {
            setFile(files[0] ?? null);
            setError(null);
          }}
          onReject={() => setError({ message: "Pranohen vetëm skedarë .p12 ose .pfx deri në 1 MB." })}
          maxSize={1024 * 1024}
          multiple={false}
          accept={{ "application/x-pkcs12": [".p12", ".pfx"], "application/octet-stream": [".p12", ".pfx"] }}
          radius="md"
        >
          <Group justify="center" gap="md" mih={96} style={{ pointerEvents: "none" }}>
            <ThemeIcon size={44} radius="md" variant="light" color={file ? "teal" : "indigo"}>
              {file ? <IconFileCertificate size={24} stroke={1.7} /> : <IconCertificate size={24} stroke={1.7} />}
            </ThemeIcon>
            <div>
              <Text fw={600}>{file ? file.name : "Tërhiq certifikatën këtu ose kliko për ta zgjedhur"}</Text>
              <Text size="sm" c="dimmed">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ".p12 ose .pfx, e lëshuar nga AKSHI/NAIS"}
              </Text>
            </div>
          </Group>
        </Dropzone>
        <PasswordInput
          label="Fjalëkalimi i certifikatës"
          leftSection={<IconLock size={16} stroke={1.8} />}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          autoComplete="off"
        />
        <Group justify="space-between" align="center">
          <Checkbox
            checked={remember}
            onChange={(e) => setRemember(e.currentTarget.checked)}
            label="Mbaje në këtë shfletues"
            description="Pa këtë, certifikata harrohet kur mbyllet skeda."
          />
          <SegmentedControl
            size="xs"
            value={environment ?? "auto"}
            onChange={(v) => setEnvironment(v === "auto" ? null : (v as "production" | "test"))}
            data={[
              { value: "auto", label: "Sipas certifikatës" },
              { value: "production", label: "Prodhim" },
              { value: "test", label: "Test" },
            ]}
          />
        </Group>
        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={error.message}>
            {error.hint}
          </Alert>
        )}
        <Text size="xs" c="dimmed">
          Certifikata hapet në këtë kompjuter. Çelësi privat ruhet në shfletues si çelës që nuk mund të eksportohet dhe nuk dërgohet as te TUFA; serverit i
          shkojnë vetëm kërkesat e nënshkruara, që i përcillen CIS. Fjalëkalimi nuk ruhet.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={close} disabled={busy}>
            Anulo
          </Button>
          <Button onClick={() => void submit()} loading={busy} leftSection={<IconCertificate size={16} stroke={1.8} />}>
            Shto certifikatën
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
