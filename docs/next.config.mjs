import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ['@oh-my-docs/ui'],
  async rewrites() {
    return [{ source: '/docs/:path*.md', destination: '/md/:path*' }];
  },
};

export default createMDX()(config);
