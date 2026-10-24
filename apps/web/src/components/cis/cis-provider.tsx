"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signWith } from "@/lib/cis/cert";
import type { CisSession } from "@/lib/cis/client";
import { loadCertificate, removeCertificate, type StoredCertificate } from "@/lib/cis/store";
import * as vault from "@/lib/filing/vault";
import { CertificateDialog, type SetupMode } from "./certificate-dialog";

export type CisCompany = { id: string; nipt: string; name: string };

/** e-Albania për e-Filing (si "filing" i cis-client-2): gati për këtë sesion, i ruajtur i enkriptuar, ose asnjë. */
export type FilingState = { configured: boolean; username: string | null; remembered: boolean };

type CisContext = {
  company: CisCompany;
  certificate: StoredCertificate | null;
  ready: boolean;
  session: CisSession | null;
  openDialog: (mode?: SetupMode) => void;
  remove: () => Promise<void>;
  setCertificate: (c: StoredCertificate) => void;
  filing: FilingState;
  saveFiling: (creds: vault.FilingCredentials, remember: boolean, passphrase: string) => Promise<void>;
  unlockFiling: (passphrase: string) => Promise<void>;
  forgetFiling: () => Promise<void>;
  filingCredentials: () => vault.FilingCredentials | null;
  refreshFiling: () => void;
};

const Ctx = createContext<CisContext | null>(null);

/** Certifikata CIS dhe të dhënat e e-Albania të subjektit aktiv, siç mbahen në këtë shfletues. */
export function useCis() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCis jashtë CisProvider");
  return ctx;
}

export function CisProvider({ company, children }: { company: CisCompany; children: React.ReactNode }) {
  const [certificate, setCertificate] = useState<StoredCertificate | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const router = useRouter();
  const [remembered, setRemembered] = useState<{ nipt: string; value: boolean } | null>(null);
  const [filingVersion, setFilingVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    loadCertificate(company.nipt).then((c) => {
      if (!alive) return;
      setCertificate(c);
      setLoadedFor(company.nipt);
    });
    vault.isRemembered(company.nipt).then((value) => alive && setRemembered({ nipt: company.nipt, value }));
    return () => {
      alive = false;
    };
  }, [company.nipt]);

  const remove = useCallback(async () => {
    await removeCertificate(company.nipt);
    setCertificate(null);
  }, [company.nipt]);

  const saveFiling = useCallback(
    async (creds: vault.FilingCredentials, remember: boolean, passphrase: string) => {
      const problem = vault.validCredentials(company.nipt, creds);
      if (problem) throw new vault.VaultError(problem);
      if (remember) {
        await vault.remember(company.nipt, creds, passphrase);
        setRemembered({ nipt: company.nipt, value: true });
      }
      vault.useForSession(company.nipt, creds);
      setFilingVersion((v) => v + 1);
    },
    [company.nipt],
  );

  const unlockFiling = useCallback(
    async (passphrase: string) => {
      vault.useForSession(company.nipt, await vault.unlock(company.nipt, passphrase));
      setFilingVersion((v) => v + 1);
    },
    [company.nipt],
  );

  const forgetFiling = useCallback(async () => {
    await vault.forget(company.nipt);
    setRemembered({ nipt: company.nipt, value: false });
    setFilingVersion((v) => v + 1);
  }, [company.nipt]);

  const current = loadedFor === company.nipt ? certificate : null;
  const value = useMemo<CisContext>(() => {
    void filingVersion; // rillogarit kur ndryshojnë të dhënat e sesionit
    const creds = vault.sessionCredentials(company.nipt);
    return {
      company,
      certificate: current,
      ready: loadedFor === company.nipt,
      session: current ? { companyId: company.id, environment: current.info.environment, signer: { sign: signWith(current.key), certificateB64: current.info.certificateB64 } } : null,
      // Certifikata: dritarja "Shto certifikatën për këtë subjekt"; e-Albania: skeda e-Filing (si cis-client).
      openDialog: (mode: SetupMode = "certificate") => (mode === "filing" ? router.push(`/app/${company.id}/filing`) : setDialog(true)),
      remove,
      setCertificate,
      filing: { configured: !!creds, username: creds?.username ?? null, remembered: remembered?.nipt === company.nipt && remembered.value },
      saveFiling,
      unlockFiling,
      forgetFiling,
      filingCredentials: () => vault.sessionCredentials(company.nipt),
      refreshFiling: () => {
        setFilingVersion((v) => v + 1);
        void vault.isRemembered(company.nipt).then((value) => setRemembered({ nipt: company.nipt, value }));
      },
    };
  }, [company, current, loadedFor, remove, remembered, filingVersion, saveFiling, unlockFiling, forgetFiling, router]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CertificateDialog opened={dialog} onClose={() => setDialog(false)} />
    </Ctx.Provider>
  );
}
