import type { NextConfig } from "next";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "connect-src 'self' https: wss:",
].join("; ");

function normalizeAllowedImageHost(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).hostname;
  } catch {
    return trimmed;
  }
}

function getAllowedImageHosts() {
  const hosts = new Set<string>(["example.com"]);
  const configuredHosts = process.env.PRODUCT_IMAGE_REMOTE_HOSTS ?? "";

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      hosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);
    } catch {
      // Ignore invalid URL env values; the app will surface broken image hosts at runtime.
    }
  }

  for (const value of configuredHosts.split(",")) {
    const host = normalizeAllowedImageHost(value);
    if (host) {
      hosts.add(host);
    }
  }

  return [...hosts].map((hostname) => ({
    protocol: "https" as const,
    hostname,
  }));
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getAllowedImageHosts(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Content-Security-Policy",
            value: CONTENT_SECURITY_POLICY,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/backoffice",
        destination: "/admin",
      },
      {
        source: "/backoffice/:path*",
        destination: "/admin/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/gtfo",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/gtfo",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
