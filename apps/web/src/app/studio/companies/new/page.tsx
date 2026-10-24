import { Title } from "@mantine/core";
import { CompanyForm } from "./company-form";
import { SetupCard } from "./setup-card";

/** Subjekt i ri: si cis-client-2 (certifikata ose NIPT + e-Albania); me ?manual=1 formulari i plotë i QKB. */
export default async function NewCompanyPage({ searchParams }: { searchParams: Promise<{ manual?: string }> }) {
  const { manual } = await searchParams;
  if (!manual) return <SetupCard />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Title order={2} fz={{ base: 20, sm: 24 }}>Subjekt i ri</Title>
      <p className="text-sm text-muted-foreground">Të dhënat siç janë në QKB. Subjekti shtohet në organizatën tënde dhe merr automatikisht integrimet dhe deklarimet sipas regjimit.</p>
      <CompanyForm />
    </div>
  );
}
