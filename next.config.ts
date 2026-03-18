import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/bitchassnigga", destination: "/admin" },
      { source: "/bitchassnigga/:path*", destination: "/admin/:path*" },
    ];
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/bitchassnigga", permanent: false },
      { source: "/admin/:path*", destination: "/bitchassnigga/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
