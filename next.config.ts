import type { NextConfig } from "next";
import { LEGACY_SALES_REDIRECTS } from "./lib/legacy-redirects";

const nextConfig: NextConfig = {
  // Allow opening the app via LAN IP during `next dev` (HMR / _next assets).
  allowedDevOrigins: ["10.110.110.77"],
  async redirects() {
    return LEGACY_SALES_REDIRECTS.map((r) => ({ ...r }));
  },
};

export default nextConfig;
