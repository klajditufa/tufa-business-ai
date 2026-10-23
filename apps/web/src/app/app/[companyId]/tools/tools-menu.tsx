"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Grupet e "Raporte & mjete", si menuja e cis-client-2. Disa lidhje çojnë te modulet ekzistuese. */
export function toolGroups(base: string) {
  return [
    {
      title: "Faturat & financat",
      items: [
        { href: `${base}/reports`, label: "Pasqyra e të ardhurave" },
        { href: `${base}/tools/items`, label: "Faturat sipas artikujve" },
        { href: `${base}/parties`, label: "Klientët & furnitorët" },
        { href: `${base}/invoices/bank`, label: "Rakordimi me bankën" },
      ],
    },
    {
      title: "Deklarimet",
      items: [
        { href: `${base}/vat`, label: "Përgatitja e TVSH-së" },
        { href: `${base}/tools/rent`, label: "Tatimi në burim · Qira" },
        { href: `${base}/tools/customs`, label: "Deklaratat doganore" },
      ],
    },
    {
      title: "Listëpagesa",
      items: [
        { href: `${base}/payroll`, label: "Listëpagesa · E-SIG 025" },
        { href: `${base}/tools/net-gross`, label: "Listëpagesa neto / bruto" },
      ],
    },
    {
      title: "Fiskalizimi",
      items: [{ href: `${base}/tools/registry`, label: "Operatorët, njësitë & pajisjet" }],
    },
  ];
}

export function ToolsMenu({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const groups = toolGroups(`/app/${companyId}`);
  const all = groups.flatMap((g) => g.items);
  const active = all.find((i) => pathname.startsWith(i.href))?.href ?? "";
  return (
    <>
      {/* Telefon: zgjedhës */}
      <select
        aria-label="Mjeti"
        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm lg:hidden"
        value={active}
        onChange={(e) => router.push(e.target.value)}
      >
        {groups.map((g) => (
          <optgroup key={g.title} label={g.title}>
            {g.items.map((i) => (
              <option key={i.href} value={i.href}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {/* Desktop: menu e grupuar */}
      <nav className="hidden rounded-xl border border-border bg-card p-3 lg:block">
        {groups.map((g) => (
          <div key={g.title} className="mb-3 last:mb-0">
            <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{g.title}</div>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm hover:bg-muted",
                  active === i.href && "bg-accent/15 font-medium text-accent",
                )}
              >
                {i.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
