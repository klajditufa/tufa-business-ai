import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/app/theme-toggle";

export const metadata: Metadata = {
  title: { default: "TUFA Business AI", template: "%s · TUFA Business AI" },
  description: "Kontabilitet, TVSH, deklarime dhe dokumente — për bizneset dhe ekonomistët në Shqipëri.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TUFA Business AI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#242424" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sq" suppressHydrationWarning>
      <head>
        {/* Tema e zgjedhur vendoset para pikturimit, që të mos ketë ndezje */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
