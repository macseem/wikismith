import type { NextConfig } from 'next';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  serverExternalPackages: ['openai', '@neondatabase/serverless', 'tar'],
};

export default nextConfig;
