import { NetGrossCalculator } from "./calculator";

export const metadata = { title: "Neto / bruto" };

export default function NetGrossPage() {
  const now = new Date();
  const month = now.getFullYear() === 2026 ? now.getMonth() + 1 : 1;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Listëpagesa neto / bruto</h2>
        <p className="text-sm text-muted-foreground">Llogarit pagën neto nga bruto, ose bruton që jep një neto të caktuar, me kontributet dhe TAP-in.</p>
      </div>
      <NetGrossCalculator defaultPeriod={`2026-${String(month).padStart(2, "0")}`} />
    </div>
  );
}
