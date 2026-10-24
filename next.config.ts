import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // One canonical host. The apex is what people type and what the GitHub README links, so it wins;
  // www redirects to it rather than the other way round.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.gpu-unlock.com" }],
        destination: "https://gpu-unlock.com/:path*",
        permanent: true,
      },
      // The bare root has to answer with a path-relative Location. Letting next-intl do it
      // produced `https://localhost:3200/en`, because a standalone build has no public
      // origin to put in the URL. Declared here, the redirect is a plain 307 to "/en".
      { source: "/", destination: "/en", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
