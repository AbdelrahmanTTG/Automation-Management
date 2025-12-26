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
    async rewrites() {
    return [
      {
        source: '/dashboard', 
        destination: '/automation/dashboard', 
      },
    ];
    },
  // Tell Next.js not to bundle these server-only packages with Turbopack.
  // They'll be resolved by Node.js require at runtime.
  serverExternalPackages: ['pm2', 'pm2-deploy'],

  // Optional: extra belt-and-suspenders for Turbopack static analysis
  // to ensure it never tries to parse the pm2-deploy shell script.
  turbopack: {
    resolveAlias: {
      'pm2-deploy/deploy': path.resolve(__dirname, 'stubs/pm2-deploy-deploy-stub.js'),
    },
  },
};

export default nextConfig;
