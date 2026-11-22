import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// basePath is set in next.config.ts — for GitHub Pages it's "/gym-tracker",
// for root hosting (Vercel, custom domain) it's "". Read it from the env at
// build time so the manifest always points to the correct URL.
const basePath = process.env.BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Fixed app identity so renames or icon changes update the installed app
    // instead of looking like a new one. Matches the old default (start_url).
    id: `${basePath}/`,
    name: "LogBook",
    short_name: "LogBook",
    description: "Log every set, spot every PR, and see where you are getting stronger. Free, works offline.",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0e0d",
    theme_color: "#0c0e0d",
    icons: [
      {
        src: `${basePath}/logbook-v1.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: `${basePath}/logbook-v1-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/logbook-v1-maskable-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/logbook-v1-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/logbook-v1-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
