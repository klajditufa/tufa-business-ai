import { Title } from "@mantine/core";
import { redirect } from "next/navigation";
import { listMyCompanies } from "@/server/services/companies";
import { OnboardingForm } from "./onboarding-form";
import { t } from "@/lib/i18n";

export default async function OnboardingPage() {
  const companies = await listMyCompanies();
  if (companies.length > 0) redirect(`/app/${companies[0].id}/dashboard`);
  const d = t();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <Title order={2} fz={{ base: 20, sm: 24 }}>{d.onboarding.title}</Title>
      <p className="mt-1 text-sm text-muted-foreground">{d.onboarding.subtitle}</p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </main>
  );
}
