import type { NextConfig } from "next";

// For GitHub Pages at `username.github.io/repo-name`, set
// BASE_PATH=/repo-name in the build environment.
// For root hosting (Vercel, custom domain, etc.), leave it empty.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export so the app can be deployed as a PWA without a server.
  output: "export",
  // Path prefix for GitHub Pages project hosting. Empty for root domains.
  basePath,
  // Disable image optimization (incompatible with static export)
  images: { unoptimized: true },
  // Trailing slash makes static export URLs more predictable for PWA hosting.
  trailingSlash: true,
};

export default nextConfig;
