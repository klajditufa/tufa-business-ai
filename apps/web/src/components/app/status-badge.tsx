import { Badge } from "@/components/ui";
import { t } from "@/lib/i18n";

export type DeclStatus = "pending" | "in_process" | "for_review" | "suspended" | "declared" | "late";

export const STATUS_TONE: Record<DeclStatus, "neutral" | "info" | "warning" | "danger" | "success"> = {
  pending: "neutral",
  in_process: "info",
  for_review: "warning",
  suspended: "warning",
  declared: "success",
  late: "danger",
};

export const KIND_LABELS: Record<string, string> = {
  vat: "TVSH",
  payroll_esig25: "Listëpagesa (E-Sig 25)",
  withholding: "Tatim në burim",
  profit_tax: "Tatim fitimi",
  simplified: "Biznes i vogël",
  annual_financial: "Pasqyrat financiare",
  other: "Tjetër",
};

export function StatusBadge({ status }: { status: DeclStatus }) {
  const d = t();
  return <Badge tone={STATUS_TONE[status]}>{d.status[status]}</Badge>;
}
