import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Rivendos fjalëkalimin</h2>
      <p className="mt-1 text-sm text-muted-foreground">Shkruaj email-in e llogarisë; do të të dërgojmë një link.</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-accent hover:underline">← Kthehu te hyrja</Link>
      </p>
    </div>
  );
}
