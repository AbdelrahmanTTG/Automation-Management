// import { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   async rewrites() {
//     return [
//       {
//         source: '/dashboard', 
//         destination: '/automation/dashboard', 
//       },
//     ];
//   },
// };

// export default nextConfig;

// next.config.ts
import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  basePath: '/auto', 

  async rewrites() {
    return [
      {
        source: '/dashboard',
        destination: '/automation/dashboard',
      },
    ];
  },

  serverExternalPackages: ['pm2', 'pm2-deploy'],

  turbopack: {
    resolveAlias: {
      'pm2-deploy/deploy': path.resolve(__dirname, 'stubs/pm2-deploy-deploy-stub.js'),
    },
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
