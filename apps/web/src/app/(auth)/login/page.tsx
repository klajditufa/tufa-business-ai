import Link from "next/link";
import { LoginForm } from "./login-form";
import { t } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const d = t();
  return (
    <div>
      <h2 className="text-2xl font-semibold">{d.auth.login}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{d.app.name}</p>
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
      <p className="mt-3 text-sm">
        <Link href="/forgot-password" className="text-accent hover:underline">{d.auth.forgot}</Link>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        {d.auth.noAccount}{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          {d.auth.startNow}
        </Link>
      </p>
    </div>
  );
}
