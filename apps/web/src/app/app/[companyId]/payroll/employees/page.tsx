import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listEmployees } from "@/server/services/payroll";
import { Card, CardTitle } from "@/components/ui";
import { EmployeeForm, type Employee } from "./employee-form";
import { EmployeeList } from "./employee-list";

/** Punonjësit e subjektit (bazë për listëpagesën). */
export default async function EmployeesPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();
  const [{ data, error }, { data: perms }] = await Promise.all([listEmployees(companyId), supabase.rpc("my_permissions", { p_company_id: companyId })]);
  const canWrite = (perms ?? []).some((p) => p.module === "payroll" && p.action === "write");
  const today = new Date().toISOString().slice(0, 10);
  const employees: Employee[] = (data ?? []).map((e) => ({ ...e, gross_salary: Number(e.gross_salary) }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <Link href={`/app/${companyId}/payroll`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> Listëpagesa
      </Link>
      <h1 className="text-2xl font-semibold">Punonjësit</h1>
      {error && <p className="text-sm text-danger">{error.message}</p>}
      <EmployeeList companyId={companyId} employees={employees} canWrite={canWrite} today={today} />
      {canWrite && (
        <Card>
          <CardTitle>Shto punonjës</CardTitle>
          <div className="mt-3"><EmployeeForm companyId={companyId} /></div>
        </Card>
      )}
    </div>
  );
}
