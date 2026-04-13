import type { NextConfig } from "next";

const normalizeBaseURL = (value: string | undefined, fallback: string) => {
  const candidate = (value ?? "").trim() || fallback;
  return candidate.replace(/\/+$/, "");
};

const internalAPIBaseURL = normalizeBaseURL(
  process.env.NEXT_INTERNAL_API_BASE_URL,
  "http://127.0.0.1:8081"
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "100.85.175.66"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${internalAPIBaseURL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
