/*
 * SetupForm i cis-client-2 (frontend/src/features/session/SetupForm.tsx), i përshtatur për TUFA:
 *  - certifikata hapet në këtë shfletues (jo te një server lokal); çelësi privat nuk eksportohet dhe nuk dërgohet,
 *    CIS e konfirmon me GetTCRs përmes /api/cis;
 *  - pa `attachTo`, subjekti krijohet në TUFA nga NIPT-i dhe emri i certifikatës (ose nga NIPT-i për e-Filing);
 *  - të dhënat e e-Albania mbahen vetëm në këtë shfletues (sesion, ose kasafortë e enkriptuar).
 */
import { Button, Checkbox, Group, PasswordInput, SegmentedControl, Stack, Text, TextInput, ThemeIcon } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconCertificate, IconFileCheck, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { ApiError } from "../../api";
import { ErrorBox } from "../../components/ui";
import { CisFault, CisUnreachable } from "@/lib/cis/client";
import { useI18n } from "../../i18n";
import { attachCertificate, openCertificate } from "@/lib/cis/setup";
import type { StoredCertificate } from "@/lib/cis/store";
import * as vault from "@/lib/filing/vault";
import { createCompanyFromSetupAction } from "@/server/actions/onboarding";
import { CredentialsFields, emptyCredentials } from "../filing/CredentialsFields";

type Choice = "auto" | "production" | "test";
export type SetupTarget = { id: string; nipt: string; name: string };
export type SetupResult = { company: SetupTarget; mode: "certificate" | "filing"; certificate: StoredCertificate | null };

const ACCEPT = { "application/x-pkcs12": [".p12", ".pfx"], "application/x-pem-file": [".pem"] };

/**
 * Upload of a .p12/.pfx certificate. The file is opened in this browser, which keeps the key
 * non-extractable and checks it with CIS; the password is needed only when the file has one.
 */
export function SetupForm({ onLoaded, attachTo }: { onLoaded: (result: SetupResult) => void; attachTo?: SetupTarget }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [environment, setEnvironment] = useState<Choice>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [includeFiling, setIncludeFiling] = useState(false);
  const [filing, setFiling] = useState(emptyCredentials);
  const [mode, setMode] = useState<"certificate" | "filing">("certificate");
  const [nipt, setNipt] = useState("");
  const [name, setName] = useState("");

  async function saveFiling(target: SetupTarget) {
    const creds = { username: filing.username, password: filing.password };
    const problem = vault.validCredentials(target.nipt, creds);
    if (problem) throw new vault.VaultError(problem);
    if (filing.remember) await vault.remember(target.nipt, creds, filing.passphrase);
    vault.useForSession(target.nipt, creds);
  }

  async function submit() {
    if (mode === "certificate" && !file) {
      setError(new Error(t("setup.noFile")));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (includeFiling) {
        // Kontrollet e të dhënave të e-Albania para se të krijohet ose të kontaktohet ndonjë gjë.
        if (filing.remember) vault.checkPassphrase(filing.passphrase);
        const expected = mode === "filing" ? nipt : attachTo?.nipt;
        if (expected) {
          const problem = vault.validCredentials(expected, filing);
          if (problem) throw new vault.VaultError(problem);
        }
      }
      let target: SetupTarget;
      let certificate: StoredCertificate | null = null;
      if (mode === "certificate" && file) {
        const opened = await openCertificate(file, password);
        if (includeFiling) {
          const problem = vault.validCredentials(opened.info.nipt!, filing);
          if (problem) throw new vault.VaultError(problem);
        }
        if (attachTo) target = attachTo;
        else {
          const created = await createCompanyFromSetupAction({ nipt: opened.info.nipt!, name: opened.info.name ?? opened.info.commonName ?? undefined });
          if (!created.ok) throw new Error(created.error);
          target = { id: created.id, nipt: opened.info.nipt!, name: opened.info.name ?? opened.info.nipt! };
        }
        certificate = await attachCertificate(target, opened, environment === "auto" ? null : environment, true);
      } else {
        const created = await createCompanyFromSetupAction({ nipt, name: name || undefined });
        if (!created.ok) throw new Error(created.error);
        target = { id: created.id, nipt, name: name || nipt };
      }
      if (includeFiling) await saveFiling(target);
      setFile(null);
      setPassword("");
      setFiling(emptyCredentials());
      setNipt("");
      setName("");
      onLoaded({ company: target, mode, certificate });
    } catch (reason) {
      // Gabimet e CIS shfaqen si te cis-client: kodi i gabimit dhe këshilla.
      if (reason instanceof CisFault)
        setError(new ApiError(502, { message: reason.message, cisError: { faultCode: reason.code ?? null, faultString: reason.message } }));
      else if (reason instanceof CisUnreachable) setError(new ApiError(502, { message: reason.message, unreachable: true }));
      else setError(reason);
    } finally {
      setBusy(false);
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
        {!attachTo && (
          <SegmentedControl
            fullWidth
            value={mode}
            disabled={busy}
            data={[
              { value: "certificate", label: t("setup.withCertificate") },
              { value: "filing", label: t("setup.filingOnly") },
            ]}
            onChange={(value) => {
              setMode(value === "filing" ? "filing" : "certificate");
              setIncludeFiling(value === "filing");
              setFiling(emptyCredentials());
              setPassword("");
              setError(null);
            }}
          />
        )}
        {mode === "filing" && (
          <>
            <Text size="sm" c="dimmed">
              {t("setup.filingLead")}
            </Text>
            <TextInput
              label={t("cert.nipt")}
              required
              value={nipt}
              maxLength={10}
              minLength={10}
              pattern="[A-Za-z][0-9]{8}[A-Za-z]"
              disabled={busy}
              autoComplete="off"
              onChange={(event) => {
                const next = event.currentTarget.value.trim().toUpperCase();
                setNipt(next);
                if (!filing.username || filing.username === nipt) setFiling({ ...filing, username: next });
              }}
            />
            <TextInput
              label={t("setup.businessName")}
              value={name}
              maxLength={200}
              disabled={busy}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </>
        )}
        {mode === "certificate" && (
          <>
            <Dropzone
              onDrop={(files) => {
                setFile(files[0] ?? null);
                setError(null);
              }}
              accept={ACCEPT}
              multiple={false}
              radius="lg"
              p="lg"
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
                    {file ? file.name : t("setup.drop")}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {file ? `${Math.max(1, Math.round(file.size / 1024))} KB · ${t("setup.change")}` : ".p12 · .pfx · .pem"}
                  </Text>
                </div>
              </Group>
            </Dropzone>
            <PasswordInput label={t("setup.password")} value={password} autoComplete="off" onChange={(event) => setPassword(event.currentTarget.value)} />
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                {t("setup.environment")}
              </Text>
              <SegmentedControl
                fullWidth
                value={environment}
                onChange={(value) => setEnvironment(value as Choice)}
                data={(["auto", "production", "test"] as const).map((value) => ({
                  value,
                  label: t(`env.${value}`),
                }))}
              />
            </Stack>
          </>
        )}
        <Checkbox
          label={t("filing.add")}
          checked={includeFiling}
          disabled={busy}
          onChange={(event) => {
            setIncludeFiling(event.currentTarget.checked);
            setFiling({ ...emptyCredentials(), username: (mode === "filing" ? nipt : attachTo?.nipt) ?? "" });
          }}
        />
        {includeFiling && <CredentialsFields value={filing} onChange={setFiling} disabled={busy} />}
        <Button type="submit" size="md" loading={busy}>
          {t(mode === "certificate" ? "setup.load" : "setup.addFiling")}
        </Button>
        {busy && mode === "certificate" && (
          <Text size="sm" c="dimmed" ta="center">
            {t("setup.loading")}
          </Text>
        )}
        {error !== null && <ErrorBox error={error} />}
      </Stack>
    </form>
  );
}
