import { Empty } from "@/components/ui";
import { fmt, t } from "@/lib/i18n";

export default function Page() {
  const d = t();
  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-2xl font-semibold">Deklarimet Tatimore</h1>
      <Empty title={fmt(d.common.comingSoon, { n: 10 })} />
    </div>
  );
}
