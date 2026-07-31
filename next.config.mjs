/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep HTTP connections alive so Apache/proxies don't get "Service Unavailable"
  // when connections are dropped between requests
  serverExternalPackages: ['mysql2'],
  httpAgentOptions: {
    keepAlive: true,
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
    prerenderEarlyExit: false,
    optimizeCss: true,
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
      'framer-motion',
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
    // Production custom domain — allow dev server to serve to this host
    'betcheza.co.ke',
    'www.betcheza.co.ke',
  ],
  async redirects() {
    return [
      // NOTE: www → non-www redirect is handled by Apache on the production server.
      // Do NOT add it here — it creates an infinite redirect loop:
      //   Apache forces www.betcheza.co.ke → Next.js redirects back → Apache forces www → loop.
      {
        source: '/3-daily-odds-strategy',
        destination: '/strategy',
        permanent: true,
      },
    ]
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    return [
      {
        // In production, Next.js static assets are content-hashed — safe to cache forever.
        // In development, Turbopack reuses chunk filenames, so we must not cache immutably.
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: isDev ? 'public, max-age=0, must-revalidate' : 'public, max-age=31536000, immutable' }],
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
        // Match pages: tell Google to allow full snippets, large images, video previews
        source: '/matches/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
        ],
      },
      {
        // Live page: always fresh
        source: '/live',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow, max-snippet:-1, max-image-preview:large' },
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=0, must-revalidate' },
        ],
      },
      {
        // HTML pages — never cache; every request goes fresh to the server.
        // no-store prevents the browser from saving the response at all, so
        // visitors always see the latest content without needing incognito.
        source: '/:path((?!_next|api|.*\\.(?:js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?|ttf|otf|mp4|webm|json|txt|xml|map)).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
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
  turbopack: {},
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        crypto: false,
      };
    }
    return config;
  },
}

export default nextConfig
