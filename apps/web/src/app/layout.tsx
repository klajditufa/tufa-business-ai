import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TUFA Business AI", template: "%s · TUFA Business AI" },
  description: "Kontabilitet, TVSH, deklarime dhe dokumente — për bizneset dhe ekonomistët në Shqipëri.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TUFA Business AI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f2b5b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sq" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
