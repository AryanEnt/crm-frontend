import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the app via LAN IP during `next dev` (HMR / _next assets).
  allowedDevOrigins: ["10.110.110.77"],
};

export default nextConfig;
