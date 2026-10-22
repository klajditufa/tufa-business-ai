import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, listMyCompanies } from "@/server/services/companies";
import { t } from "@/lib/i18n";

/** Administrimi i platformës: vetëm për super admin (të tjerët marrin 404). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, companies] = await Promise.all([getProfile(), listMyCompanies()]);
  if (!profile || !("is_super_admin" in profile) || !profile.is_super_admin) notFound();
  const d = t();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
        <span className="font-semibold">{d.app.name} · Administrimi</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/tax-rules" className="hover:underline">Rregullat tatimore</Link>
        </nav>
        {companies[0] && (
          <Link href={`/app/${companies[0].id}/dashboard`} className="ml-auto text-sm text-accent hover:underline">→ Paneli</Link>
        )}
      </header>
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
