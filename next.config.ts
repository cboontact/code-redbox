import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // School marks are local public assets; serving them directly avoids an
    // unavailable Worker image-transform binding in local and Cloudflare runs.
    unoptimized: true,
  },
};

export default nextConfig;
