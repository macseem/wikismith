import type { NextConfig } from 'next';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(import.meta.dirname, '../../.env') });

const nextConfig: NextConfig = {
  serverExternalPackages: ['openai', '@neondatabase/serverless', 'tar'],
};

export default nextConfig;
