import type { NextConfig } from "next";

// Toggle alternative LaunchPad branding (hero + nav brand). Swap to false to use the default BlogAI branding.
const SHOW_LAUNCHPAD_BRANDING = false;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SHOW_LAUNCHPAD_BRANDING: String(SHOW_LAUNCHPAD_BRANDING),
  },
};

export default nextConfig;
