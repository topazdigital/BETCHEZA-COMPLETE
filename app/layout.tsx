import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { UserSettingsProvider } from '@/contexts/user-settings-context'
import { AuthProvider } from '@/contexts/auth-context'
import { AuthModalProvider } from '@/contexts/auth-modal-context'
import { AuthModal } from '@/components/auth/auth-modal'
import { AIChatButton } from '@/components/ai/ai-chat-button'
import { InstallPrompt } from '@/components/install-prompt'
import { BetSlipProvider } from '@/contexts/bet-slip-context'
import { BetSlipPanel } from '@/components/bet-slip/bet-slip-panel'
import { getSiteSettings, parseSeoPages, findSeoForPath } from '@/lib/site-settings'
import './globals.css'

const geist = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
});
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
});

/**
 * Build metadata dynamically so admin-managed branding (site name,
 * description, favicon) and per-page SEO overrides apply automatically.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') || '/';
  const seoEntry = findSeoForPath(parseSeoPages(settings.seo_pages), pathname);

  // Per-path title/description improvements for pages without admin SEO overrides
  const isHomePage = pathname === '/';
  const fallbackTitle = isHomePage
    ? `${settings.site_name} — #1 Sports Betting Tips Community | Free Expert Predictions`
    : `${settings.site_name} - Expert Betting Tips & Predictions`;
  const fallbackDescription = isHomePage
    ? `Join ${settings.site_name}, the #1 platform for free sports betting tips and expert predictions. Get AI-powered forecasts, track tipster performance, and beat the bookmakers across football, basketball, tennis and 35+ sports.`
    : settings.site_description;

  const title = seoEntry?.title || fallbackTitle;
  const description = seoEntry?.description || fallbackDescription;
  const keywords = seoEntry?.keywords
    ? seoEntry.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : [
        'betting tips', 'sports predictions', 'free betting tips',
        'football tips today', 'tipster community', 'expert predictions',
        'betting advice', 'sports betting Kenya', 'odds comparison',
        'win rate tipsters', 'AI sports predictions', 'bet of the day',
      ];

  // Build the icons list. If the admin uploaded a custom favicon, prefer it.
  const customFavicon = settings.favicon_url?.trim();
  const icons: Metadata['icons'] = customFavicon
    ? { icon: customFavicon, apple: customFavicon }
    : {
        // SVG-first so the redesigned Betcheza mark renders crisply in modern browsers.
        // PNGs stay as fallbacks for legacy / RSS readers.
        icon: [
          { url: '/icon.svg', type: 'image/svg+xml' },
          { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)', sizes: '32x32' },
          { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)', sizes: '32x32' },
        ],
        apple: '/apple-icon.png',
      };

  return {
    title: {
      default: title,
      template: `%s | ${settings.site_name}`,
    },
    description,
    keywords,
    authors: [{ name: settings.site_name }],
    creator: settings.site_name,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke'),
    robots: seoEntry?.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: settings.site_name,
      title,
      description,
      images: seoEntry?.ogImage ? [{ url: seoEntry.ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: seoEntry?.ogImage ? [seoEntry.ogImage] : undefined,
    },
    manifest: '/manifest.json',
    icons,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AuthModalProvider>
              <BetSlipProvider>
              <UserSettingsProvider>
                {children}
                <AuthModal />
                <AIChatButton />
                <InstallPrompt />
                <BetSlipPanel />
              </UserSettingsProvider>
            </BetSlipProvider>
            </AuthModalProvider>
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
