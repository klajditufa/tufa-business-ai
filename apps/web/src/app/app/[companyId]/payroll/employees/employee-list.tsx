"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { date, money } from "@/lib/format";
import { EmployeeForm, type Employee } from "./employee-form";

export function EmployeeList({ companyId, employees, canWrite, today }: { companyId: string; employees: Employee[]; canWrite: boolean; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Card className="p-0">
      <ul className="divide-y divide-border">
        {employees.map((e) => {
          const active = e.start_date <= today && (!e.end_date || e.end_date >= today);
          return (
            <li key={e.id} className="px-4 py-3">
              {editing === e.id ? (
                <EmployeeForm companyId={companyId} employee={e} onDone={() => { setEditing(null); router.refresh(); }} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {e.first_name} {e.last_name}{" "}
                      {e.kind === "owner" && <Badge tone="info">pronar</Badge>}{" "}
                      {!active && <Badge tone="neutral">{e.start_date > today ? `nga ${date(e.start_date)}` : `larguar ${date(e.end_date)}`}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{e.personal_no ?? "pa NID"}</span>{e.position ? ` · ${e.position}` : ""} · nga {date(e.start_date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular">{Number(e.gross_salary) ? money(e.gross_salary, "ALL", 0) : "paga minimale"}</span>
                    {canWrite && (
                      <button type="button" onClick={() => setEditing(e.id)} className="text-muted-foreground hover:text-foreground" aria-label={`Ndrysho ${e.first_name}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {employees.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Ende pa punonjës.</li>}
      </ul>
    </Card>
  );
}
