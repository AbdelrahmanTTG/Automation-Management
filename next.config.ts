import { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/dashboard', 
        destination: '/automation/dashboard', 
      },
    ];
  },
};

export default nextConfig;
