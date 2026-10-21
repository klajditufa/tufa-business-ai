"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDeclarationStatusAction, type SettableStatus } from "@/server/actions/declarations";
import { cn } from "@/lib/utils";

const OPTIONS: { value: SettableStatus; label: string; cls: string }[] = [
  { value: "in_process", label: "Në proces", cls: "hover:bg-accent/15 text-accent" },
  { value: "for_review", label: "Për kontroll", cls: "hover:bg-warning/15 text-warning" },
  { value: "suspended", label: "Pezull", cls: "hover:bg-warning/15 text-warning" },
  { value: "declared", label: "Deklaro ✓", cls: "bg-success text-white hover:opacity-90" },
];

/** Butonat e statusit për kontabilistin. Kompakt (për matricë) ose i plotë. */
export function StatusActions({ id, current, compact, revalidate }: { id: string; current: string; compact?: boolean; revalidate: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: SettableStatus) => {
    let notes: string | undefined;
    if (s === "suspended") notes = prompt("Arsyeja e pezullimit (p.sh. mungojnë dokumentet):") ?? undefined;
    start(async () => {
      const res = await setDeclarationStatusAction(id, s, notes, revalidate);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  };
  if (current === "declared") {
    return (
      <button onClick={() => set("in_process")} disabled={pending} className="text-xs text-muted-foreground hover:underline" title="Rihap">
        rihap
      </button>
    );
  }
  return (
    <div className={cn("flex flex-wrap gap-1", compact && "justify-end")}>
      {OPTIONS.filter((o) => o.value !== current).map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
          disabled={pending}
          className={cn("rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50", o.cls, compact && o.value !== "declared" && "hidden sm:inline-block")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
