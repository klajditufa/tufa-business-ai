"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/*
 * Tregues ngarkimi për çdo kalim faqeje. Faqet e TUFA merren nga serveri (RLS, Supabase), prandaj
 * pas klikimit kalon pak kohë para se të shfaqet faqja e re: pa tregues dukej sikur butoni nuk u shtyp.
 *
 *  - navigate(href): router.push brenda një transition-i; `navigating` mbetet true derisa faqja e re të vizatohet;
 *  - klikimet në <Link> kapen në nivel dokumenti dhe mbyllen kur ndryshon URL-ja;
 *  - shirit i hollë indigo në krye të faqes gjatë gjithë kohës.
 */

type Nav = { navigate: (href: string) => void; navigating: boolean; target: string | null };
const NavContext = createContext<Nav>({ navigate: () => {}, navigating: false, target: null });

export const useNav = () => useContext(NavContext);

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [pushTarget, setPushTarget] = useState<string | null>(null);

  const navigate = useCallback(
    (href: string) => {
      setPushTarget(href);
      startTransition(() => router.push(href));
    },
    [router],
  );

  // Klikimet në lidhje të brendshme (Link, <a>) — pa modifikues, pa target të ri, URL tjetër.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname.includes("/export") || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setLinkTarget(url.pathname + url.search);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const navigating = pending || linkTarget !== null;
  const value = useMemo<Nav>(() => ({ navigate, navigating, target: pending ? pushTarget : linkTarget }), [navigate, navigating, pending, pushTarget, linkTarget]);

  return (
    <NavContext.Provider value={value}>
      <Suspense fallback={null}>
        <RouteWatcher onChange={() => setLinkTarget(null)} />
      </Suspense>
      {navigating && <div className="nav-progress" role="progressbar" aria-label="Duke ngarkuar" />}
      {children}
    </NavContext.Provider>
  );
}

/** Mbyll treguesin e klikimeve kur URL-ja e re është vizatuar. */
function RouteWatcher({ onChange }: { onChange: () => void }) {
  const key = `${usePathname()}?${useSearchParams().toString()}`;
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    onChange();
  }
  // Siguri: nëse navigimi dështon ose anulohet, treguesi nuk mbetet përgjithmonë.
  useEffect(() => {
    const t = setTimeout(onChange, 20000);
    return () => clearTimeout(t);
  });
  return null;
}
