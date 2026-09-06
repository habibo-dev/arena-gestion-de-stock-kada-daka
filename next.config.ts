import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native / worker-based packages must not be bundled by Next.js.
  serverExternalPackages: ["better-sqlite3", "sharp", "tesseract.js", "exceljs"],
  images: {
    // Images are served from the local file API; Next image optimisation is not needed here.
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
