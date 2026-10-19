import Link from "next/link";
import { RegisterForm } from "./register-form";
import { t } from "@/lib/i18n";

export default function RegisterPage() {
  const d = t();
  return (
    <div>
      <h2 className="text-2xl font-semibold">{d.auth.register}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{d.app.name}</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        {d.auth.hasAccount}{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {d.auth.login}
        </Link>
      </p>
    </div>
  );
}
