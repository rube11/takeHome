import type { NextConfig } from 'next';

const config: NextConfig = {
  devIndicators: false,
  // Other hosts allowed to load the dev server (for example a phone on the same network),
  // as a comma-separated list in DEV_ORIGINS. See README.
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',') ?? [],
};

export default config;
