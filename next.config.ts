import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker builds set DOCKER_BUILD=1. Vercel's normal Next.js build leaves this off.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["argon2", "@prisma/client"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
