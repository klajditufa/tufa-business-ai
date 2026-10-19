"use client";

import { useRouter, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import type { Company } from "@/server/services/companies";

/** Header: zgjedhja e subjektit aktiv. Ruan rrugën e modulit kur ndërron subjekt. */
export function CompanySwitcher({ current, companies }: { current: Company; companies: Company[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = pathname.replace(`/app/${current.id}`, `/app/${e.target.value}`);
    router.push(next);
  };
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      {companies.length > 1 ? (
        <select
          value={current.id}
          onChange={onChange}
          className="h-9 max-w-[60vw] rounded-lg border border-border bg-card px-2 text-sm font-medium"
          aria-label="Subjekti aktiv"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.trade_name || c.legal_name} · {c.nipt}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm font-medium">
          {current.trade_name || current.legal_name} <span className="text-muted-foreground">· {current.nipt}</span>
        </span>
      )}
    </div>
  );
}
