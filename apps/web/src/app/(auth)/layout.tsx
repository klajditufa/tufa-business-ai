import { t } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const d = t();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="text-lg font-semibold tracking-tight text-white">{d.app.name}</div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight text-white">{d.app.tagline}</h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/90">
            Thjeshtoni kontabilitetin, ndiqni shpenzimet, menaxhoni faturat dhe qëndroni gjithmonë në rregull me
            shtetin. Përqendrohuni te rritja e biznesit tuaj, për letrat mendojmë ne.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/70">© {new Date().getFullYear()} TUFA Consulting</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
