import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark svg-captcha as external so it's not bundled
      if (!config.externals) {
        config.externals = []
      }
      config.externals.push('svg-captcha')
    }
    return config
  },
};

export default nextConfig;
