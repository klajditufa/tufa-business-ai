import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, listMyCompanies } from "@/server/services/companies";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";

/** Paneli i studios: për org_owner / accountant me disa subjekte. */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const [profile, companies] = await Promise.all([getProfile(), listMyCompanies()]);
  if (companies.length === 0) redirect("/onboarding");
  const d = t();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/studio" className="font-semibold">{d.app.name} · Paneli i studios</Link>
        <nav className="hidden gap-3 text-sm sm:flex">
          <Link href="/studio/overview" className="hover:underline">Pasqyra</Link>
          <Link href="/studio" className="hover:underline">Deklarimet</Link>
          <Link href="/studio/companies" className="hover:underline">Subjektet</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href={`/app/${companies[0].id}/dashboard`} className="text-sm text-accent hover:underline">→ Paneli i subjektit</Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">{profile?.full_name || profile?.email}</span>
          <form action={logoutAction}><Button variant="secondary" size="sm">{d.nav.logout}</Button></form>
        </div>
      </header>
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
