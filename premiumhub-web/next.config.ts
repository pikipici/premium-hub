import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:18082/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
