import { redirect } from "next/navigation";
import { getProfile, listMyCompanies } from "@/server/services/companies";

/** /app → subjekti i fundit i përdorur, ose i pari, ose onboarding. */
export default async function AppIndex() {
  const [profile, companies] = await Promise.all([getProfile(), listMyCompanies()]);
  if (companies.length === 0) redirect("/onboarding");
  const last = companies.find((c) => c.id === profile?.last_company_id);
  redirect(`/app/${(last ?? companies[0]).id}/dashboard`);
}
