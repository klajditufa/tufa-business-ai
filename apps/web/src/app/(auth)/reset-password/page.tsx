import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Fjalëkalim i ri</h2>
      <p className="mt-1 text-sm text-muted-foreground">Zgjidh një fjalëkalim të ri për llogarinë tënde.</p>
      <div className="mt-6">
        <ResetForm />
      </div>
    </div>
  );
}
