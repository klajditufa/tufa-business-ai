import { CompanyForm } from "./company-form";

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Subjekt i ri</h1>
      <p className="text-sm text-muted-foreground">Të dhënat siç janë në QKB. Subjekti shtohet në organizatën tënde dhe merr automatikisht integrimet dhe deklarimet sipas regjimit.</p>
      <CompanyForm />
    </div>
  );
}
