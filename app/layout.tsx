import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { UserSettingsProvider } from '@/contexts/user-settings-context'
import { AuthProvider } from '@/contexts/auth-context'
import { AuthModalProvider } from '@/contexts/auth-modal-context'
import { AuthModal } from '@/components/auth/auth-modal'
import { GoogleOneTap } from '@/components/auth/google-one-tap'
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
        // Core brand + Kenya bookmaker keywords
        'SportPesa', 'SportPesa tips', 'SportPesa mega jackpot', 'SportPesa mega jackpot predictions',
        'SportPesa jackpot this week', 'SportPesa midweek jackpot tips',
        'Betika', 'Betika tips', 'Betika grand jackpot', 'Betika grand jackpot tips', 'Betika tips today',
        'Odibets', 'Odibets predictions', 'Odibets tips today',
        'Betway Kenya', 'Betway Kenya tips',
        'Mozzartbet Kenya', 'Mozzartbet tips',
        '1xBet Kenya', '1xBet Kenya predictions',
        'Premiertabet Kenya', 'Shabiki tips', 'Elitebet Kenya',
        // Free tips keywords
        'free betting tips Kenya', 'free football tips today Kenya', 'free soccer tips Kenya',
        'sports betting Kenya', 'betting tips Kenya today', 'football tips today Kenya',
        'football predictions today Kenya', 'football betting tips free',
        // League/jackpot keywords
        'Kenya Premier League tips', 'KPL predictions', 'KPL tips today',
        'Premier League tips Kenya', 'Champions League predictions Kenya',
        'jackpot predictions Kenya', 'jackpot tips Kenya', 'mega jackpot predictions',
        'grand jackpot tips', 'jackpot banker today', 'jackpot tips today Kenya',
        // AI/community keywords
        'AI football predictions', 'AI betting tips Kenya', 'free sports tips',
        'tipster community Kenya', 'best tipsters Kenya', 'top football tipsters Kenya',
        'expert betting advice Kenya', 'tipster leaderboard Kenya',
        // Betting market keywords
        'correct score today Kenya', 'BTTS tips Kenya', 'over 2.5 goals tips',
        'accumulator tips today', 'double chance tips', 'Asian handicap tips',
        'M-Pesa betting Kenya', 'bet of the day Kenya', 'banker of the day Kenya',
        // Competition/discovery keywords
        'betcheza', 'betcheza.co.ke', 'Kenya betting site', 'best betting site Kenya',
        'sports betting tips Africa', 'football tips Africa',
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
      images: seoEntry?.ogImage
        ? [{ url: seoEntry.ogImage, width: 1200, height: 630, alt: title }]
        : [{ url: '/og-image.png', width: 1200, height: 630, alt: `${settings.site_name} — Sports Betting Tips` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: seoEntry?.ogImage ? [seoEntry.ogImage] : ['/og-image.png'],
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

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Betcheza',
  url: 'https://betcheza.co.ke',
  description: "Kenya's #1 sports betting tips community. AI-powered predictions, SportPesa jackpot tips, tipster leaderboard and community.",
  inLanguage: 'en',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://betcheza.co.ke/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Betcheza',
  url: 'https://betcheza.co.ke',
  logo: 'https://betcheza.co.ke/icon.svg',
  description: "Kenya's leading sports betting tipster community platform with AI predictions.",
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    url: 'https://betcheza.co.ke/contact',
  },
  sameAs: [],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Betcheza free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Betcheza is completely free. You can view AI predictions, follow tipsters, and access betting tips at no cost.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the AI football predictor work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza uses AI (GPT-4o-mini) to analyse match data, team form, head-to-head records and odds to generate win probability and market recommendations for each game.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I get SportPesa jackpot tips on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza publishes free AI-powered predictions for SportPesa Midweek Jackpot, SportPesa Mega Jackpot, Betika Grand Jackpot and other Kenyan bookmaker jackpots — updated daily.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I follow a tipster?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Visit the Tipsters page, browse by win rate or ROI, and click any tipster to view their profile and full tip history. Create a free account to follow tipsters and get notifications.',
      },
    },
    {
      '@type': 'Question',
      name: 'How are tipster win rates calculated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Win rates are calculated from settled tips only — the percentage of tips that resulted in a winning outcome. ROI factors in the odds of each pick to show long-term profitability.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Betcheza cover the Kenya Premier League (KPL)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza covers the Kenya Premier League as well as 35+ other sports and leagues including the Premier League, Champions League, La Liga, Bundesliga and Serie A.',
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
          suppressHydrationWarning
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          suppressHydrationWarning
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          suppressHydrationWarning
        />
      </head>
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
                <GoogleOneTap />
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
