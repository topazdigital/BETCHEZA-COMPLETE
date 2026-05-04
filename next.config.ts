import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: false, formats: ['image/avif','image/webp'], minimumCacheTTL: 86400 },
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/_next/static/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/api/site-settings', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=60' }] },
      { source: '/api/jackpot(.*)', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=600, stale-while-revalidate=120' }] },
      { source: '/api/sports', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=600' }] },
      { source: '/api/leagues', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=600' }] },
    ];
  },
  experimental: { optimizePackageImports: ['lucide-react','@radix-ui/react-accordion','@radix-ui/react-dialog','@radix-ui/react-dropdown-menu','@radix-ui/react-select','@radix-ui/react-tabs','recharts'] },
};
export default nextConfig;
