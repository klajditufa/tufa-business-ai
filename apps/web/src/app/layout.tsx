import type { Metadata, Viewport } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "./layers.css";
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "./globals.css";
import { Providers } from "./providers";

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
    <html lang="sq" {...mantineHtmlProps}>
      <head>
        {/* Tema e ruajtur vendoset para pikturimit (pa ndezje) */}
        <ColorSchemeScript defaultColorScheme="auto" localStorageKey="tufa-color-scheme" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
