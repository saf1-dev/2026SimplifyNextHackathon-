import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.platform === "win32" ? undefined : "standalone",
  transpilePackages: [
    "@motomoto/data-access",
    "@motomoto/domain",
    "@motomoto/groq",
    "@motomoto/valuation",
  ],
};

export default nextConfig;
