/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 604800,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [24, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-tooltip',
      'recharts',
      'date-fns',
    ],
  },
  allowedDevOrigins: [
    '*.replit.dev',
    '*.replit.app',
    '*.riker.replit.dev',
    '*.kirk.replit.dev',
    '*.picard.replit.dev',
    '*.janeway.replit.dev',
    '*.spock.replit.dev',
    '*.sisko.replit.dev',
    '*.worf.replit.dev',
    '*.worf.replit.dev',
  ],
  async redirects() {
    return [
      // Redirect www → non-www to prevent duplicate content in Google Search Console
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.betcheza.co.ke' }],
        destination: 'https://betcheza.co.ke/:path*',
        permanent: true,
      },
      {
        source: '/3-daily-odds-strategy',
        destination: '/strategy',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        // Next.js static assets are content-hashed — safe to cache forever
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.jpg',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.webp',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.avif',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.svg',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.ico',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.woff2',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.woff',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/api/home',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' }],
      },
      {
        source: '/api/site-settings',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' }],
      },
      {
        source: '/api/bookmakers',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' }],
      },
      {
        source: '/api/matches',
        headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }],
      },
      {
        source: '/api/tipsters',
        headers: [{ key: 'Cache-Control', value: 's-maxage=120, stale-while-revalidate=300' }],
      },
      {
        source: '/api/featured',
        headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=120' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Preconnect to image CDNs so team logos resolve DNS before they render
          {
            key: 'Link',
            value: [
              '<https://a.espncdn.com>; rel=preconnect',
              '<https://a.espncdn.com>; rel=dns-prefetch',
              '<https://media.api-sports.io>; rel=preconnect; crossorigin',
              '<https://media.api-sports.io>; rel=dns-prefetch',
              '<https://resources.premierleague.com>; rel=preconnect',
              '<https://resources.premierleague.com>; rel=dns-prefetch',
              '<https://upload.wikimedia.org>; rel=preconnect',
              '<https://cdn.worldvectorlogo.com>; rel=dns-prefetch',
            ].join(', '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
