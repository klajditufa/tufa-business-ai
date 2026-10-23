"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { signWith } from "@/lib/cis/cert";
import type { CisSession } from "@/lib/cis/client";
import { loadCertificate, removeCertificate, type StoredCertificate } from "@/lib/cis/store";
import { CertificateDialog } from "./certificate-dialog";

export type CisCompany = { id: string; nipt: string; name: string };

type CisContext = {
  company: CisCompany;
  certificate: StoredCertificate | null;
  ready: boolean;
  session: CisSession | null;
  openDialog: () => void;
  remove: () => Promise<void>;
  setCertificate: (c: StoredCertificate) => void;
};

const Ctx = createContext<CisContext | null>(null);

/** Certifikata CIS e subjektit aktiv, siç ruhet në këtë shfletues. */
export function useCis() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCis jashtë CisProvider");
  return ctx;
}

export function CisProvider({ company, children }: { company: CisCompany; children: React.ReactNode }) {
  const [certificate, setCertificate] = useState<StoredCertificate | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCertificate(company.nipt).then((c) => {
      if (!alive) return;
      setCertificate(c);
      setLoadedFor(company.nipt);
    });
    return () => {
      alive = false;
    };
  }, [company.nipt]);

  const remove = useCallback(async () => {
    await removeCertificate(company.nipt);
    setCertificate(null);
  }, [company.nipt]);

  const current = loadedFor === company.nipt ? certificate : null;
  const value = useMemo<CisContext>(
    () => ({
      company,
      certificate: current,
      ready: loadedFor === company.nipt,
      session: current ? { companyId: company.id, environment: current.info.environment, signer: { sign: signWith(current.key), certificateB64: current.info.certificateB64 } } : null,
      openDialog: () => setDialog(true),
      remove,
      setCertificate,
    }),
    [company, current, loadedFor, remove],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CertificateDialog opened={dialog} onClose={() => setDialog(false)} />
    </Ctx.Provider>
  );
}
