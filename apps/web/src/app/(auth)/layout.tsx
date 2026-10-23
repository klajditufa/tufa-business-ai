import { IconReceipt as ReceiptText } from "@tabler/icons-react";
import { t } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const d = t();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-[#4263eb] to-[#364fc7] p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <ReceiptText className="h-[18px] w-[18px]" />
          </span>
          {d.app.name}
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">{d.app.tagline}</h1>
          <p className="mt-4 max-w-md text-white/85">
            Faturat nga fiskalizimi, TVSH-ja, listëpagesat dhe deklaratat nga C@TS, për çdo subjekt që menaxhoni, në një vend.
          </p>
        </div>
        <p className="text-xs text-white/70">© {new Date().getFullYear()} TUFA Consulting</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
