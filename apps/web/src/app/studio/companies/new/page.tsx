import { Title } from "@mantine/core";
import { CompanyForm } from "./company-form";

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Title order={2} fz={{ base: 20, sm: 24 }}>Subjekt i ri</Title>
      <p className="text-sm text-muted-foreground">Të dhënat siç janë në QKB. Subjekti shtohet në organizatën tënde dhe merr automatikisht integrimet dhe deklarimet sipas regjimit.</p>
      <CompanyForm />
    </div>
  );
}
