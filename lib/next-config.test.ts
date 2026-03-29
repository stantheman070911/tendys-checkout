import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next.config admin routing", () => {
  it("rewrites the hidden admin path into the internal admin tree", async () => {
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites).toEqual([
      {
        source: "/backoffice",
        destination: "/admin",
      },
      {
        source: "/backoffice/:path*",
        destination: "/admin/:path*",
      },
    ]);
  });

  it("redirects public admin probes to /gtfo", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual([
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
    ]);
  });
});
