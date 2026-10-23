import { redirect } from "next/navigation";

export default async function ToolsIndex({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  redirect(`/app/${companyId}/tools/net-gross`);
}
