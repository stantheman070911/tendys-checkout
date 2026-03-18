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
      { source: "/admin", destination: "/gtfo", permanent: false },
      { source: "/admin/:path*", destination: "/gtfo", permanent: false },
    ];
  },
};

export default nextConfig;
