/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
  ],
  async redirects() {
    return [
      {
        source: '/3-daily-odds-strategy',
        destination: '/strategy',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
