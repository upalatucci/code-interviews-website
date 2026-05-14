import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PatternFly ships its own CSS; transpile for SSR compatibility
  transpilePackages: [
    '@patternfly/react-core',
    '@patternfly/react-icons',
    '@patternfly/react-styles',
  ],
};

export default nextConfig;
