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
      // The card list and the same-card measurements live on the reference site. Keeping a
      // second copy here is what made the two hosts read as duplicate content, so those
      // paths point at the one place that owns them.
      {
        source: "/:locale/gpus",
        destination: "https://gpuunlock.com/:locale/gpus",
        statusCode: 301,
      },
      {
        source: "/:locale/gpus/:slug",
        destination: "https://gpuunlock.com/:locale/gpus/:slug",
        statusCode: 301,
      },
      {
        source: "/:locale/benchmarks",
        destination: "https://gpuunlock.com/:locale/benchmarks",
        statusCode: 301,
      },
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
