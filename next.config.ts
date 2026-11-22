import type { NextConfig } from 'next';

const config: NextConfig = {
  devIndicators: false,
  // Other hosts allowed to load the dev server (for example a phone on the same network),
  // as a comma-separated list in DEV_ORIGINS. See README.
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',') ?? [],
  // The stock page reads each stock's saved API data by a file name built at runtime, which
  // the build can't trace, so ship the folder with it.
  outputFileTracingIncludes: {
    '/stocks/*': ['./data/.cache/stocks/**/*'],
  },
};

export default config;
