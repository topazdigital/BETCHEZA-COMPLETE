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
import { Toaster } from 'sonner'
import { NavigationProgress } from '@/components/layout/navigation-progress'
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
        // ── Brand ──────────────────────────────────────────────────────────────
        'Betcheza', 'betcheza.co.ke', 'Betcheza tips', 'Betcheza predictions',
        'Betcheza Kenya', 'Betcheza jackpot', 'Betcheza AI predictor',

        // ── SportPesa ──────────────────────────────────────────────────────────
        'SportPesa', 'SportPesa tips', 'SportPesa predictions',
        'SportPesa mega jackpot', 'SportPesa mega jackpot predictions',
        'SportPesa mega jackpot tips this week', 'SportPesa jackpot this week',
        'SportPesa midweek jackpot', 'SportPesa midweek jackpot tips',
        'SportPesa midweek jackpot predictions', 'SportPesa jackpot banker',
        'SportPesa jackpot results', 'SportPesa jackpot analysis',
        'SportPesa tips today', 'SportPesa free tips', 'win SportPesa jackpot',
        'SportPesa jackpot 13/13', 'SportPesa jackpot winners',

        // ── Betika ─────────────────────────────────────────────────────────────
        'Betika', 'Betika tips', 'Betika tips today', 'Betika predictions',
        'Betika grand jackpot', 'Betika grand jackpot tips',
        'Betika grand jackpot predictions', 'Betika jackpot analysis',
        'Betika jackpot banker today', 'Betika midweek jackpot tips',
        'Betika free tips', 'Betika winning tips', 'Betika jackpot results',
        'how to win Betika jackpot', 'Betika jackpot 17/17',

        // ── Odibets ────────────────────────────────────────────────────────────
        'Odibets', 'Odibets tips', 'Odibets tips today', 'Odibets predictions',
        'Odibets jackpot tips', 'Odibets free tips', 'Odibets winning tips',
        'Odibets jackpot predictions', 'Odibets jackpot banker',

        // ── Betway Kenya ───────────────────────────────────────────────────────
        'Betway Kenya', 'Betway Kenya tips', 'Betway Kenya predictions',
        'Betway tips today Kenya', 'Betway free tips Kenya',
        'Betway jackpot Kenya', 'Betway Kenya free bets',

        // ── Mozzartbet ─────────────────────────────────────────────────────────
        'Mozzartbet Kenya', 'Mozzartbet tips', 'Mozzartbet predictions',
        'Mozzartbet jackpot tips', 'Mozzartbet tips today',

        // ── 1xBet Kenya ────────────────────────────────────────────────────────
        '1xBet Kenya', '1xBet Kenya tips', '1xBet Kenya predictions',
        '1xBet free tips Kenya', '1xBet jackpot tips Kenya',

        // ── Other Kenya bookmakers ─────────────────────────────────────────────
        'Premiertabet Kenya', 'Premiertabet tips', 'Premiertabet predictions',
        'Shabiki tips', 'Shabiki jackpot tips', 'Shabiki predictions',
        'Elitebet Kenya', 'Elitebet tips', 'Elitebet jackpot tips',
        'Helabet Kenya', 'Helabet tips', 'Helabet predictions',
        'Dafabet Kenya', 'Dafabet tips',
        'BetLion Kenya', 'BetLion tips',
        'Parimatch Kenya', 'Parimatch tips',
        'Bangbet Kenya', 'Bangbet tips',
        '22bet Kenya', '22bet tips Kenya',
        'Msport Kenya', 'Msport tips',
        'Betin Kenya', 'Betin tips',
        'MyBet Kenya', 'MyBet tips',
        'Bamboo Bet Kenya', 'Bamboo Bet tips',
        'Chezacash Kenya', 'Chezacash tips',
        'Tempobet Kenya', 'Kenya betting site',

        // ── Free tips core ─────────────────────────────────────────────────────
        'free betting tips Kenya', 'free football tips today Kenya',
        'free soccer tips Kenya today', 'free tips Kenya today',
        'free football predictions Kenya', 'free sports predictions Kenya',
        'today free tips Kenya', 'free sure tips Kenya',
        'genuine free tips Kenya', 'legit betting tips Kenya',

        // ── Sports betting Kenya ───────────────────────────────────────────────
        'sports betting Kenya', 'online betting Kenya', 'football betting Kenya',
        'betting tips Kenya today', 'betting predictions Kenya',
        'football tips today Kenya', 'football tips Kenya',
        'football predictions today Kenya', 'soccer tips Kenya',
        'soccer predictions Kenya', 'betting advice Kenya',
        'best betting tips Kenya', 'winning betting tips Kenya',
        'safe betting tips Kenya', 'sure betting tips Kenya',
        'value betting Kenya', 'smart betting Kenya',

        // ── KPL / local football ───────────────────────────────────────────────
        'Kenya Premier League tips', 'KPL predictions', 'KPL tips today',
        'KPL tips', 'KPL free tips', 'Kenya Premier League predictions',
        'KPL match predictions', 'KPL results today', 'KPL standings',
        'Gor Mahia tips', 'AFC Leopards tips', 'Tusker FC tips',
        'KCB FC tips', 'Bandari FC tips', 'Ulinzi Stars tips',
        'Kenya football predictions', 'NSL predictions Kenya',

        // ── African football ───────────────────────────────────────────────────
        'AFCON predictions', 'CAF Champions League tips', 'NPFL tips Nigeria',
        'Ghana Premier League tips', 'AFCON tips', 'CAF tips',
        'South Africa PSL tips', 'Tanzania Premier League tips',
        'Uganda Premier League tips', 'African football tips',

        // ── Global leagues ─────────────────────────────────────────────────────
        'Premier League tips Kenya', 'EPL tips Kenya', 'EPL predictions Kenya',
        'Champions League predictions Kenya', 'UCL tips Kenya',
        'La Liga tips Kenya', 'Serie A tips Kenya', 'Bundesliga tips Kenya',
        'Ligue 1 tips Kenya', 'Europa League tips', 'Conference League tips',
        'FA Cup tips', 'Carabao Cup tips', 'Copa del Rey tips',

        // ── Jackpot keywords ───────────────────────────────────────────────────
        'jackpot predictions Kenya', 'jackpot tips Kenya', 'jackpot tips today Kenya',
        'jackpot banker today', 'jackpot banker Kenya', 'jackpot analysis Kenya',
        'mega jackpot predictions', 'mega jackpot tips', 'grand jackpot tips',
        'jackpot tips free Kenya', 'jackpot winners Kenya', 'jackpot strategies Kenya',
        'how to win jackpot Kenya', 'jackpot accumulator Kenya',
        'SportPesa jackpot 13 games', 'Betika jackpot 17 games',

        // ── Accumulator / combo tips ───────────────────────────────────────────
        'accumulator tips today Kenya', 'acca tips Kenya', 'combo tips Kenya',
        'double tips Kenya', 'treble tips Kenya', 'multi tips Kenya',
        'parlay tips Kenya', '3 odds tips Kenya', '5 odds tips Kenya',
        '10 odds tips Kenya', 'high odds tips Kenya', 'boosted odds Kenya',

        // ── Betting markets ────────────────────────────────────────────────────
        'correct score today Kenya', 'correct score tips Kenya',
        'BTTS tips Kenya', 'both teams to score Kenya', 'BTTS predictions Kenya',
        'over 2.5 goals tips Kenya', 'under 2.5 goals tips',
        'over 1.5 goals tips', 'over 3.5 goals tips Kenya',
        'double chance tips Kenya', 'double chance predictions',
        'Asian handicap tips Kenya', 'handicap tips Kenya',
        'draw tips Kenya', 'home win tips', 'away win tips Kenya',
        'half time full time tips', 'HT FT tips Kenya',
        'anytime scorer tips', 'first goal scorer tips',

        // ── Bet of day / banker ────────────────────────────────────────────────
        'bet of the day Kenya', 'banker of the day Kenya',
        'daily banker Kenya', 'sure bet Kenya', 'sure odds Kenya',
        'daily tips Kenya', 'weekend tips Kenya', 'midweek tips Kenya',
        'Saturday tips Kenya', 'Sunday tips Kenya',

        // ── M-Pesa / deposit ───────────────────────────────────────────────────
        'M-Pesa betting Kenya', 'bet with M-Pesa Kenya',
        'M-Pesa sports betting', 'online betting M-Pesa Kenya',
        'deposit via M-Pesa betting', 'withdraw betting winnings M-Pesa',

        // ── AI / tech-forward ──────────────────────────────────────────────────
        'AI football predictions', 'AI betting tips Kenya',
        'AI sports predictor Kenya', 'machine learning football tips',
        'data-driven betting tips', 'statistical football predictions Kenya',
        'xG predictions Kenya', 'form-based tips Kenya',

        // ── Tipster / community ────────────────────────────────────────────────
        'tipster community Kenya', 'best tipsters Kenya',
        'top football tipsters Kenya', 'tipster leaderboard Kenya',
        'follow tipsters Kenya', 'free tipster Kenya', 'pro tipster Kenya',
        'verified tipster Kenya', 'expert betting advice Kenya',
        'betting community Kenya', 'sports tips community Kenya',

        // ── Discovery / info ───────────────────────────────────────────────────
        'best betting site Kenya', 'top betting site Kenya',
        'betting tips site Kenya', 'sports betting tips Africa',
        'football tips Africa', 'free tips Africa',
        'Kenya betting app', 'betting predictions app Kenya',
        'football tips app Kenya', 'live scores Kenya betting',
        'football results Kenya', 'live football scores Kenya',
        'odds comparison Kenya', 'best odds Kenya',

        // ── Responsible gambling ───────────────────────────────────────────────
        'responsible gambling Kenya', 'betting strategy Kenya',
        'bankroll management Kenya', '3 daily odds strategy Kenya',
        'compounding strategy betting Kenya',
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
          { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
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
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke'),
    robots: seoEntry?.noIndex ? { index: false, follow: false } : undefined,
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke'}${pathname === '/' ? '' : pathname}`,
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
  '@id': 'https://betcheza.co.ke/#website',
  name: 'Betcheza',
  alternateName: ['Betcheza Kenya', 'Betcheza Tips', 'betcheza.co.ke'],
  url: 'https://betcheza.co.ke',
  description: "Kenya's #1 sports betting tips community. AI-powered predictions, SportPesa jackpot tips, tipster leaderboard and community.",
  inLanguage: 'en',
  publisher: { '@id': 'https://betcheza.co.ke/#organization' },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://betcheza.co.ke/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://betcheza.co.ke/#organization',
  name: 'Betcheza',
  legalName: 'Betcheza',
  alternateName: 'Betcheza Kenya',
  url: 'https://betcheza.co.ke',
  logo: {
    '@type': 'ImageObject',
    url: 'https://betcheza.co.ke/icon-512.png',
    width: 512,
    height: 512,
  },
  image: 'https://betcheza.co.ke/og-image.png',
  description: "Kenya's #1 sports betting tipster community — free AI-powered predictions, jackpot tips, and expert tipster leaderboard.",
  foundingDate: '2024',
  areaServed: { '@type': 'Country', name: 'Kenya' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    url: 'https://betcheza.co.ke/contact',
    areaServed: 'KE',
    availableLanguage: 'English',
  },
  sameAs: [
    'https://www.facebook.com/betcheza',
    'https://twitter.com/betcheza',
    'https://www.instagram.com/betcheza',
  ],
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
      <head>
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
        <NavigationProgress />
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
                <Toaster position="top-right" richColors closeButton />
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
