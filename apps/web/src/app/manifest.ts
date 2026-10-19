import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TUFA Business AI",
    short_name: "TUFA",
    description: "Kontabilitet, TVSH, deklarime dhe dokumente për bizneset në Shqipëri",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#0f2b5b",
    lang: "sq",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
