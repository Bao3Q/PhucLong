import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Proxy same-origin: browser gọi /api/* và Next.js chuyển tiếp tới backend —
  // không cần CORS, không cần hardcode API host ở client. Đặt NEXT_PUBLIC_API_URL
  // để gọi thẳng backend (bỏ qua proxy).
  async rewrites() {
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ?? "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }];
  },
};

export default nextConfig;
