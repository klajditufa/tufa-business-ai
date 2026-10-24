"use client";

import { useEffect, useState } from "react";
import { Alert, Anchor, Badge, Button, Group, Paper, PasswordInput, Stack, Text } from "@mantine/core";
import { IconDownload, IconExternalLink, IconKey, IconLockOpen, IconLogin2, IconRefresh, IconX } from "@tabler/icons-react";
import { detectExtension, onStatus, request, MIN_EXTENSION, type FilingStatus, type PortalSnapshot } from "@/lib/filing/extension";
import { useCis } from "./cis-provider";

const PORTAL = "https://efiling.tatime.gov.al/cats_public/";

const STATUS: Record<string, { color: string; text: string }> = {
  connecting: { color: "blue", text: "Duke hyrë në e-Albania si biznes… Mbajeni skedën e portalit të hapur." },
  otp: { color: "blue", text: "e-Albania kërkon kodin e dërguar në telefon, email ose aplikacionin e autentifikimit." },
  "otp-wrong": { color: "yellow", text: "Kodi nuk u pranua. Shkruani kodin e ri që ju dërgoi e-Albania." },
  "otp-failed": { color: "red", text: "Kodi u refuzua disa herë. Riprovoni lidhjen." },
  verifying: { color: "blue", text: "Po verifikohet kodi…" },
  captcha: {
    color: "yellow",
    text: "e-Albania kërkon CAPTCHA. Plotësojeni vetë në skedën e portalit dhe përfundoni hyrjen atje; pastaj “Merr faqen e portalit”.",
  },
  authenticated: { color: "teal", text: "Hyrja në e-Filing u krye. Identiteti i subjektit u verifikua." },
  credentials: { color: "red", text: "Vendosni ose kontrolloni NUIS-in dhe fjalëkalimin e e-Albania për këtë subjekt." },
  taxpayer: { color: "red", text: "Subjekti në portal nuk përputhet me këtë biznes. Kontrolloni NUIS-in përpara se të vazhdoni." },
  portal: { color: "yellow", text: "Hyrja duket e kryer, por NIPT-i i subjektit nuk u gjet në kokën e faqes. Kontrolloni skedën e portalit." },
  login: { color: "yellow", text: "Përfundoni identifikimin me e-Albania në portalin zyrtar." },
  unsupported: { color: "yellow", text: "Ky variant hyrjeje nuk mbështetet. Përfundoni hyrjen në portalin zyrtar." },
  unavailable: { color: "red", text: "e-Albania nuk e përfundoi hyrjen. Riprovoni lidhjen." },
  cancelled: { color: "gray", text: "Hyrja u anulua." },
  closed: { color: "gray", text: "Skeda e portalit u mbyll." },
  noextension: { color: "red", text: "Shtesa “TUFA · e-Filing” nuk u përgjigj. Rifreskoni faqen pasi ta keni instaluar." },
};

const CAPTURE_ERRORS: Record<string, string> = {
  nopage: "Hapni në Chrome një faqe të e-Filing (Listëpagesa të Dorëzuara ose Shfaq Detajet) dhe provoni sërish.",
  login: "Hyni fillimisht në e-Filing me e-Albania.",
  unsupported: "Faqja e hapur nuk është faqe e e-Filing që mund të lexohet.",
  noextension: STATUS.noextension.text,
};

const WAITING = new Set(["connecting", "otp", "otp-wrong", "verifying"]);

/**
 * Lidhja me e-Filing (si FilingView + ManagedBrowserPanel i cis-client-2): hyrja automatike me e-Albania përmes
 * shtesës së Chrome, kodi OTP nga përdoruesi dhe marrja e faqes së hapur të portalit. Asnjë deklaratë nuk dorëzohet.
 */
export function FilingConnect({ onSnapshot }: { onSnapshot: (snapshot: PortalSnapshot) => void }) {
  const { company, filing, openDialog, filingCredentials, unlockFiling } = useCis();
  const [extension, setExtension] = useState<{ version: string; current: boolean } | null | undefined>(undefined);
  const [job, setJob] = useState<string | null>(null);
  const [status, setStatus] = useState<FilingStatus | "noextension" | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"login" | "otp" | "capture" | "unlock" | null>(null);
  const [message, setMessage] = useState<{ color: string; text: string } | null>(null);
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    let alive = true;
    detectExtension().then((found) => alive && setExtension(found));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => (job ? onStatus(job, setStatus) : undefined), [job]);

  const login = async () => {
    const creds = filingCredentials();
    if (!creds) return openDialog("filing");
    const id = crypto.randomUUID();
    setJob(id);
    setStatus("connecting");
    setMessage(null);
    setBusy("login");
    const result = await request("filing-login", { id, nipt: company.nipt.toUpperCase(), username: creds.username, password: creds.password });
    setBusy(null);
    if (!result.ok) setStatus((result.code as FilingStatus) ?? "unavailable");
  };

  const verify = async () => {
    if (!job) return;
    setBusy("otp");
    const result = await request("filing-otp", { id: job, code });
    setCode("");
    setBusy(null);
    if (!result.ok) setStatus((result.code as FilingStatus) ?? "unavailable");
  };

  const cancel = async () => {
    if (job) await request("filing-cancel", { id: job });
    setStatus("cancelled");
  };

  const capture = async () => {
    setBusy("capture");
    setMessage(null);
    const result = await request("filing-capture", { id: crypto.randomUUID(), nipt: company.nipt.toUpperCase() });
    setBusy(null);
    if (result.ok && result.snapshot) {
      onSnapshot(result.snapshot);
      setMessage({ color: "teal", text: `U mor faqja “${result.snapshot.title || "e-Filing"}”. Kontrolloni paraparjen më poshtë dhe shtypni “Importo”.` });
    } else if (result.code === "taxpayer") {
      setMessage({ color: "red", text: result.nipt ? `Faqja e hapur është e subjektit ${result.nipt}, jo e ${company.nipt}.` : CAPTURE_ERRORS.nopage });
    } else {
      setMessage({ color: "red", text: CAPTURE_ERRORS[result.code ?? ""] ?? CAPTURE_ERRORS.nopage });
    }
  };

  const unlock = async () => {
    setBusy("unlock");
    setMessage(null);
    try {
      await unlockFiling(passphrase);
      setPassphrase("");
    } catch (e) {
      setMessage({ color: "red", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const shown = status ? STATUS[status] : null;
  const waiting = !!status && WAITING.has(status);

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" gap="xs">
          <Group gap="xs">
            <Text fw={600}>e-Filing (C@TS) me e-Albania</Text>
            {status === "authenticated" && <Badge color="teal">C@TS</Badge>}
            {filing.configured && (
              <Badge variant="light" color="teal" leftSection={<IconKey size={11} />}>
                {filing.username}
              </Badge>
            )}
          </Group>
          <Button component="a" href={PORTAL} target="_blank" rel="noopener noreferrer" variant="default" size="xs" leftSection={<IconExternalLink size={14} />}>
            Hap portalin e-Filing
          </Button>
        </Group>

        {extension === null && (
          <Alert color="yellow" title="Instaloni një herë shtesën “TUFA · e-Filing” në Chrome">
            <Text size="sm">
              Shkarkoni{" "}
              <Anchor href="/tufa-efiling.zip" download>
                tufa-efiling.zip
              </Anchor>{" "}
              dhe çpaketojeni. Në Chrome → chrome://extensions aktivizoni Developer mode → Load unpacked → zgjidhni dosjen tufa-efiling. Pastaj rifreskoni
              këtë faqe.
            </Text>
          </Alert>
        )}
        {extension && !extension.current && (
          <Alert color="yellow" title={`Përditësoni shtesën (keni ${extension.version}, duhet ${MIN_EXTENSION})`}>
            <Group gap="xs">
              <Text size="sm">Shkarkoni versionin e ri, çpaketojeni mbi dosjen e vjetër dhe shtypni Reload te chrome://extensions.</Text>
              <Button component="a" href="/tufa-efiling.zip" download size="compact-xs" variant="light" leftSection={<IconDownload size={12} />}>
                Shkarko
              </Button>
            </Group>
          </Alert>
        )}

        {!filing.configured && filing.remembered && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <Group align="end" gap="xs">
              <PasswordInput
                label="Fjalëkalimi i kasafortës"
                description="Të dhënat e hyrjes janë ruajtur të enkriptuara. Zhbllokojini me fjalëkalimin e kasafortës."
                value={passphrase}
                autoComplete="off"
                required
                style={{ flex: 1 }}
                onChange={(e) => setPassphrase(e.currentTarget.value)}
              />
              <Button type="submit" loading={busy === "unlock"} leftSection={<IconLockOpen size={16} />}>
                Zhblloko të dhënat e ruajtura
              </Button>
            </Group>
          </form>
        )}
        {!filing.configured && !filing.remembered && (
          <Text size="sm" c="dimmed">
            Shtoni NUIS-in dhe fjalëkalimin e e-Albania të subjektit; TUFA hyn automatikisht në e-Filing përmes e-Albania. Të dhënat mbeten vetëm në këtë
            shfletues.
          </Text>
        )}

        {shown && (
          <Alert color={shown.color} variant="light" role="status" aria-live="polite">
            {shown.text}
          </Alert>
        )}
        {(status === "otp" || status === "otp-wrong") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <Group align="end" gap="xs">
              <PasswordInput
                label="Kodi i verifikimit të e-Albania"
                value={code}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                onChange={(e) => setCode(e.currentTarget.value.replace(/[^0-9]/g, ""))}
              />
              <Button type="submit" loading={busy === "otp"} disabled={!/^[0-9]{4,8}$/.test(code)}>
                Verifiko kodin
              </Button>
            </Group>
          </form>
        )}

        <Group gap="xs">
          {filing.configured ? (
            <Button
              onClick={() => void login()}
              loading={busy === "login"}
              disabled={!extension || waiting}
              leftSection={status && !waiting && status !== "authenticated" ? <IconRefresh size={16} /> : <IconLogin2 size={16} />}
            >
              {status && !waiting && status !== "authenticated" ? "Riprovo lidhjen" : "Hyr në e-Filing"}
            </Button>
          ) : (
            !filing.remembered && (
              <Button variant="light" leftSection={<IconKey size={16} />} onClick={() => openDialog("filing")}>
                Shto të dhënat e e-Albania
              </Button>
            )
          )}
          {waiting && (
            <Button variant="subtle" color="gray" leftSection={<IconX size={16} />} onClick={() => void cancel()}>
              Anulo
            </Button>
          )}
          <Button variant={status === "authenticated" ? "filled" : "light"} onClick={() => void capture()} loading={busy === "capture"} disabled={!extension}>
            Merr faqen e portalit
          </Button>
        </Group>
        {message && (
          <Alert color={message.color} variant="light">
            {message.text}
          </Alert>
        )}
        <Text size="xs" c="dimmed">
          Në portal hapni Listëpagesa të Dorëzuara (ose Shfaq Detajet e një muaji); NIPT-i duhet të duket te kreu i llogarisë. Pastaj “Merr faqen e
          portalit”. Verifikimi, deklarimi dhe pagesat përfundohen në portalin zyrtar. Hyrja e vjetër e e-Filing nuk plotësohet kurrë; CAPTCHA plotësohet nga
          ju.
        </Text>
      </Stack>
    </Paper>
  );
}
