"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, PasswordInput, SegmentedControl, Stack, Text, TextInput, ThemeIcon } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconAlertCircle, IconCertificate, IconFileCheck, IconUpload, IconX } from "@tabler/icons-react";
import { CertificateError, importSigningKey, openPkcs12, signWith } from "@/lib/cis/cert";
import { CisFault, CisUnreachable, registry } from "@/lib/cis/client";
import { FAULT_HINTS } from "@/lib/cis/parse";
import { saveCertificate } from "@/lib/cis/store";
import { checkPassphrase, validCredentials, VaultError } from "@/lib/filing/vault";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { useCis } from "./cis-provider";
import { CredentialsFields, emptyCredentials, type CredentialsValue } from "./credentials-fields";

export type SetupMode = "certificate" | "filing";
type Choice = "auto" | "production" | "test";

const ACCEPT = { "application/x-pkcs12": [".p12", ".pfx"], "application/octet-stream": [".p12", ".pfx"] };

/**
 * Si SetupForm i cis-client-2: "Me certifikatë" (skedari .p12/.pfx, fjalëkalimi nëse ka, mjedisi, dhe opsionalisht
 * të dhënat e e-Albania) ose "Vetëm e-Filing" (vetëm të dhënat e e-Albania).
 * Certifikata hapet në këtë shfletues dhe verifikohet me CIS (GetTCRs); çelësi privat nuk eksportohet dhe nuk dërgohet.
 * Të dhënat e e-Albania mbahen vetëm në këtë shfletues (sesion, ose të enkriptuara me fjalëkalimin e kasafortës).
 */
export function CertificateDialog({ mode: opened, onClose }: { mode: SetupMode | null; onClose: () => void }) {
  const { company } = useCis();
  return (
    <Modal opened={opened !== null} onClose={onClose} title={company.name} size="lg">
      {opened && <SetupForm key={`${company.nipt}-${opened}`} initial={opened} onDone={onClose} />}
    </Modal>
  );
}

function SetupForm({ initial, onDone }: { initial: SetupMode; onDone: () => void }) {
  const { company, setCertificate, saveFiling, filing: filingState } = useCis();
  const [mode, setMode] = useState<SetupMode>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(true);
  const [environment, setEnvironment] = useState<Choice>("auto");
  const [includeFiling, setIncludeFiling] = useState(initial === "filing");
  const [filing, setFiling] = useState<CredentialsValue>(() => emptyCredentials(company.nipt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  async function submit() {
    setError(null);
    // Të dhënat e e-Albania kontrollohen para se të kontaktohet CIS.
    if (includeFiling) {
      const problem = validCredentials(company.nipt, filing);
      if (problem) return setError({ message: problem });
      if (filing.remember) {
        try {
          checkPassphrase(filing.passphrase);
        } catch (e) {
          return setError({ message: (e as Error).message });
        }
      }
    }
    if (mode === "certificate" && !file) return setError({ message: "Zgjidhni fillimisht skedarin e certifikatës." });
    setBusy(true);
    try {
      if (mode === "certificate" && file) {
        const { info, pkcs8 } = openPkcs12(await file.arrayBuffer(), password);
        if (!info.nipt) throw new CertificateError("Certifikata nuk ka NIPT; CIS nuk e pranon.");
        if (info.nipt !== company.nipt.toUpperCase()) {
          throw new CertificateError(`Kjo certifikatë është për NIPT ${info.nipt}, jo për ${company.nipt}. Zgjidhni subjektin e duhur.`);
        }
        if (info.expired) throw new CertificateError(`Certifikata ka skaduar më ${info.validTo.slice(0, 10).split("-").reverse().join(".")}.`);
        const key = await importSigningKey(pkcs8);
        const env = environment === "auto" ? info.environment : environment;
        const stored = { nipt: info.nipt, info: { ...info, environment: env }, key, savedAt: new Date().toISOString(), persisted: keep };
        // Konfirmimi me CIS (si cis-client): pajisjet e subjektit; ruhen edhe te regjistrat.
        const tcrs = await registry.tcrs({ companyId: company.id, environment: env, signer: { sign: signWith(key), certificateB64: info.certificateB64 } });
        await createClient().rpc("set_company_registry", { p_company_id: company.id, p_kind: "tcrs", p_rows: tcrs as unknown as Json });
        await saveCertificate(stored);
        setCertificate(stored);
      }
      if (includeFiling) await saveFiling({ username: filing.username, password: filing.password }, filing.remember, filing.passphrase);
      setPassword("");
      setFiling(emptyCredentials(company.nipt));
      onDone();
    } catch (e) {
      setBusy(false);
      if (e instanceof CisFault) setError({ message: e.message, hint: (e.code && FAULT_HINTS[e.code]) || undefined });
      else if (e instanceof CertificateError || e instanceof CisUnreachable || e instanceof VaultError) setError({ message: e.message });
      else setError({ message: e instanceof Error ? e.message : "Certifikata nuk u hap." });
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Ngarkoni certifikatën për faturat, ose vetëm të dhënat e e-Albania për e-Filing. NIPT {company.nipt}.
        </Text>
        <SegmentedControl
          fullWidth
          value={mode}
          disabled={busy}
          data={[
            { value: "certificate", label: "Me certifikatë" },
            { value: "filing", label: "Vetëm e-Filing" },
          ]}
          onChange={(value) => {
            setMode(value === "filing" ? "filing" : "certificate");
            setIncludeFiling(value === "filing");
            setFiling(emptyCredentials(company.nipt));
            setPassword("");
            setError(null);
          }}
        />
        {mode === "filing" && (
          <>
            <Text size="sm" c="dimmed">
              Shtoni të dhënat e e-Albania të subjektit për lidhje automatike me e-Filing. Certifikatën e fiskalizimit për faturat mund ta shtoni më vonë.
            </Text>
            <TextInput label="NIPT" value={company.nipt} readOnly variant="filled" />
          </>
        )}
        {mode === "certificate" && (
          <>
            <Dropzone
              onDrop={(files) => {
                setFile(files[0] ?? null);
                setError(null);
              }}
              onReject={() => setError({ message: "Pranohen vetëm skedarë .p12 ose .pfx deri në 1 MB." })}
              accept={ACCEPT}
              maxSize={1024 * 1024}
              multiple={false}
              radius="lg"
              p="lg"
              disabled={busy}
            >
              <Group justify="center" gap="md" wrap="nowrap" mih={92} style={{ pointerEvents: "none" }}>
                <Dropzone.Accept>
                  <ThemeIcon size={48} radius="xl" variant="light" color="indigo">
                    <IconUpload size={24} />
                  </ThemeIcon>
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <ThemeIcon size={48} radius="xl" variant="light" color="red">
                    <IconX size={24} />
                  </ThemeIcon>
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <ThemeIcon size={48} radius="xl" variant="light" color={file ? "teal" : "gray"}>
                    {file ? <IconFileCheck size={24} /> : <IconCertificate size={24} />}
                  </ThemeIcon>
                </Dropzone.Idle>
                <div>
                  <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                    {file ? file.name : "Tërhiqeni certifikatën këtu ose klikoni për të zgjedhur skedarin"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {file ? `${Math.max(1, Math.round(file.size / 1024))} KB · Zgjidhni një skedar tjetër` : ".p12 · .pfx"}
                  </Text>
                </div>
              </Group>
            </Dropzone>
            <PasswordInput
              label="Fjalëkalimi i certifikatës (nëse ka)"
              value={password}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Mjedisi
              </Text>
              <SegmentedControl
                fullWidth
                value={environment}
                disabled={busy}
                onChange={(value) => setEnvironment(value as Choice)}
                data={[
                  { value: "auto", label: "Automatik" },
                  { value: "production", label: "Production" },
                  { value: "test", label: "Test" },
                ]}
              />
            </Stack>
            <Checkbox
              checked={keep}
              disabled={busy}
              onChange={(e) => setKeep(e.currentTarget.checked)}
              label="Mbaje certifikatën në këtë shfletues"
              description="Pa këtë, certifikata harrohet kur mbyllet skeda."
            />
          </>
        )}
        {mode === "certificate" && (
          <Checkbox
            label={filingState.configured ? "Ndrysho të dhënat e e-Albania (opsionale)" : "Shto të dhënat e e-Albania (opsionale)"}
            checked={includeFiling}
            disabled={busy}
            onChange={(event) => {
              setIncludeFiling(event.currentTarget.checked);
              setFiling(emptyCredentials(company.nipt));
            }}
          />
        )}
        {includeFiling && <CredentialsFields value={filing} onChange={setFiling} disabled={busy} />}
        <Button type="submit" size="md" loading={busy}>
          {mode === "certificate" ? "Ngarko certifikatën" : "Ruaj të dhënat e e-Albania"}
        </Button>
        {busy && mode === "certificate" && (
          <Text size="sm" c="dimmed" ta="center">
            Po verifikohet certifikata me CIS…
          </Text>
        )}
        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={error.message}>
            {error.hint}
          </Alert>
        )}
        <Text size="xs" c="dimmed">
          Certifikata hapet në këtë kompjuter: çelësi privat ruhet në shfletues si çelës që nuk eksportohet dhe nuk dërgohet as te TUFA; kërkesat
          nënshkruhen këtu dhe vetëm pjesa publike e certifikatës shkon me to te tatimet. Fjalëkalimi i certifikatës nuk ruhet. Të dhënat e e-Albania nuk
          dërgohen te serveri i TUFA: mbahen në këtë shfletues dhe i jepen vetëm shtesës “TUFA · e-Filing” për hyrjen.
        </Text>
      </Stack>
    </form>
  );
}
