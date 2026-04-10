import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', '@prisma/client', 'prisma'],
};

export default nextConfig;
