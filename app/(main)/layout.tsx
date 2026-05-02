"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, Calendar, Trophy, Users, BarChart3, Radio, Bookmark,
  Menu, X, LogIn, LogOut, ChevronDown,
  Star, Wallet, User, Sparkles, UserPlus, MessageSquare, Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeaderSearch } from "@/components/layout/header-search"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Footer } from "@/components/layout/footer"
import { CookieBanner } from "@/components/layout/cookie-banner"
import { useMatchStats } from "@/lib/hooks/use-matches"
import { ALL_SPORTS as SPORTS_LIST, ALL_LEAGUES, getSportIcon } from "@/lib/sports-data"
import { FlagIcon } from "@/components/ui/flag-icon"

const POPULAR_LEAGUE_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
const INTERNATIONAL_LEAGUE_IDS = [9, 10, 26, 102, 24, 29, 30, 31];

// Country code → league IDs mapping for "your country first" feature
const COUNTRY_LEAGUE_MAP: Record<string, number[]> = {
  KE: [9022], TZ: [9028], UG: [9029], NG: [9027], GH: [9026],
  ZA: [96], EG: [97], MA: [98], TN: [99], DZ: [100],
  GB: [1, 44, 41], ES: [2, 47], DE: [3, 49], IT: [4, 51],
  FR: [5], US: [200, 201], AU: [20], MX: [27], CN: [28],
};

// Detect user's country code from Intl timezone
function detectCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Africa/Nairobi') || tz.startsWith('Africa/Dar') || tz === 'Africa/Kampala') return 'KE';
    if (tz.startsWith('Africa/Lagos') || tz.startsWith('Africa/Kano')) return 'NG';
    if (tz.startsWith('Africa/Accra')) return 'GH';
    if (tz.startsWith('Africa/Dar_es_Salaam')) return 'TZ';
    if (tz.startsWith('Africa/Kampala')) return 'UG';
    if (tz.startsWith('Africa/Johannesburg')) return 'ZA';
    if (tz.startsWith('Africa/Cairo')) return 'EG';
    if (tz.startsWith('Africa/Casablanca') || tz.startsWith('Africa/El_Aaiun')) return 'MA';
    if (tz.startsWith('Europe/London')) return 'GB';
    if (tz.startsWith('Europe/Madrid')) return 'ES';
    if (tz.startsWith('Europe/Berlin') || tz.startsWith('Europe/Vienna') || tz.startsWith('Europe/Zurich')) return 'DE';
    if (tz.startsWith('Europe/Rome')) return 'IT';
    if (tz.startsWith('Europe/Paris')) return 'FR';
    if (tz.startsWith('America/New_York') || tz.startsWith('America/Los_Angeles') || tz.startsWith('America/Chicago')) return 'US';
    if (tz.startsWith('Australia/')) return 'AU';
    if (tz.startsWith('America/Mexico_City')) return 'MX';
    if (tz.startsWith('Asia/Shanghai') || tz.startsWith('Asia/Hong_Kong')) return 'CN';
    return '';
  } catch { return ''; }
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badgeKey?: 'live' | 'today';
  color: string;
  activeColor: string;
}

const mainNavItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, color: "text-blue-500", activeColor: "bg-blue-500" },
  { href: "/live", label: "Live", icon: Radio, badgeKey: 'live', color: "text-red-500", activeColor: "bg-red-500" },
  { href: "/matches", label: "Matches", icon: Calendar, badgeKey: 'today', color: "text-green-500", activeColor: "bg-green-500" },
  { href: "/predictor", label: "AI Predictor", icon: Sparkles, color: "text-purple-500", activeColor: "bg-purple-500" },
  { href: "/feed", label: "Community Feed", icon: MessageSquare, color: "text-teal-500", activeColor: "bg-teal-500" },
  { href: "/tipsters", label: "Tipsters", icon: Users, color: "text-orange-500", activeColor: "bg-orange-500" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, color: "text-yellow-500", activeColor: "bg-yellow-500" },
  { href: "/competitions", label: "Competitions", icon: Star, color: "text-pink-500", activeColor: "bg-pink-500" },
  { href: "/results", label: "Results", icon: BarChart3, color: "text-slate-400", activeColor: "bg-slate-500" },
  { href: "/become-tipster", label: "Become a Tipster", icon: UserPlus, color: "text-indigo-500", activeColor: "bg-indigo-500" },
]

// Popular bookmakers for the sidebar
const SIDEBAR_BOOKMAKERS = [
  { name: "Bet365", slug: "bet365", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Bet365_logo.svg/200px-Bet365_logo.svg.png" },
  { name: "1xBet", slug: "1xbet", logo: "https://1xbet.co.ke/favicon.ico" },
  { name: "SportPesa", slug: "sportpesa", logo: "https://www.sportpesa.co.ke/favicon.ico" },
  { name: "Betway", slug: "betway", logo: "https://www.betway.co.ke/favicon.ico" },
  { name: "Odibets", slug: "odibets", logo: "https://odibets.com/favicon.ico" },
  { name: "Mozzartbet", slug: "mozzartbet", logo: "https://mozzartbet.co.ke/favicon.ico" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isAuthenticated, logout, isLoading } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSports, setShowSports] = useState(false)
  const [showLeagues, setShowLeagues] = useState(false)
  const [showInternationals, setShowInternationals] = useState(false)
  const [showBookmakers, setShowBookmakers] = useState(false)
  const [userCountry, setUserCountry] = useState<string>('KE')
  const [intlMatchCount, setIntlMatchCount] = useState(0)
  const stats = useMatchStats()
  const [branding, setBranding] = useState<{ siteName: string; logoUrl: string; logoDarkUrl: string }>({
    siteName: "Betcheza",
    logoUrl: "",
    logoDarkUrl: "",
  })

  useEffect(() => {
    setUserCountry(detectCountryCode() || 'KE')
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setBranding({
          siteName: d.siteName || "Betcheza",
          logoUrl: d.logoUrl || "",
          logoDarkUrl: d.logoDarkUrl || "",
        })
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  // Fetch today's international match count for the Internationals badge
  useEffect(() => {
    fetch('/api/matches?category=international&limit=50')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const matches = d.matches || d || []
        if (Array.isArray(matches)) setIntlMatchCount(matches.length)
      })
      .catch(() => undefined)
  }, [])

  // Build popular leagues list: user's country leagues first, then global popular
  const popularLeagues = (() => {
    const countryIds = COUNTRY_LEAGUE_MAP[userCountry] || []
    const countryLeagues = ALL_LEAGUES.filter(l => countryIds.includes(l.id))
    const globalLeagues = ALL_LEAGUES
      .filter(l => POPULAR_LEAGUE_IDS.includes(l.id) && !countryIds.includes(l.id))
      .sort((a, b) => POPULAR_LEAGUE_IDS.indexOf(a.id) - POPULAR_LEAGUE_IDS.indexOf(b.id))
    return [...countryLeagues, ...globalLeagues]
  })()

  const internationalLeagues = ALL_LEAGUES
    .filter(l => INTERNATIONAL_LEAGUE_IDS.includes(l.id))
    .sort((a, b) => INTERNATIONAL_LEAGUE_IDS.indexOf(a.id) - INTERNATIONAL_LEAGUE_IDS.indexOf(b.id))

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-56 transform flex-col overflow-y-auto border-r border-border bg-card transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <Link href="/" className="flex items-center gap-2">
            {branding.logoUrl ? (
              <>
                <img
                  src={branding.logoUrl}
                  alt={branding.siteName}
                  className={`h-7 w-auto object-contain ${branding.logoDarkUrl ? 'block dark:hidden' : ''}`}
                />
                {branding.logoDarkUrl && (
                  <img
                    src={branding.logoDarkUrl}
                    alt={branding.siteName}
                    className="hidden h-7 w-auto object-contain dark:block"
                  />
                )}
              </>
            ) : (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                  {branding.siteName.split(" ").filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("").slice(0, 2) || "BZ"}
                </div>
                <span className="text-sm font-bold">{branding.siteName}</span>
              </>
            )}
          </Link>
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation — colorful tabs */}
        <nav className="space-y-0.5 p-2">
          {mainNavItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? `${item.activeColor} text-white`
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <item.icon className={cn("h-3.5 w-3.5", !isActive && item.color)} />
                  {item.label}
                </div>
                {item.badgeKey && (() => {
                  const count = item.badgeKey === 'live' ? stats.live : stats.today
                  if (!count) return null
                  return (
                    <span className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      isActive ? "bg-white/20 text-white" : (item.badgeKey === 'live' ? "bg-red-500 text-white" : "bg-primary text-primary-foreground")
                    )}>
                      {count}
                    </span>
                  )
                })()}
              </Link>
            )
          })}
        </nav>

        {/* Sports */}
        <div className="border-t border-border p-2">
          <button 
            onClick={() => setShowSports(!showSports)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Sports
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSports && "rotate-180")} />
          </button>
          {showSports && (
            <div className="mt-0.5 space-y-0.5">
              {SPORTS_LIST?.map((sport) => (
                <Link
                  key={sport.id}
                  href={`/matches?sport=${sport.slug}`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <span className="text-sm">{getSportIcon(sport.slug)}</span>
                  {sport.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Popular Leagues — user's country first */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setShowLeagues(!showLeagues)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3 w-3 text-primary" /> Popular Leagues
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showLeagues && "rotate-180")} />
          </button>
          {showLeagues && (
            <div className="mt-0.5 space-y-0.5">
              {popularLeagues.map((league, idx) => {
                const isCountry = (COUNTRY_LEAGUE_MAP[userCountry] || []).includes(league.id)
                return (
                  <Link
                    key={league.id}
                    href={`/leagues/${league.slug}`}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <FlagIcon countryCode={league.countryCode} size="xs" />
                    <span className="truncate">{league.name}</span>
                    {isCountry && idx === 0 && (
                      <span className="ml-auto shrink-0 text-[9px] font-bold uppercase text-primary">Local</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Internationals — shows today's count badge */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setShowInternationals(!showInternationals)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Star className="h-3 w-3 text-orange-500" /> Internationals
            </span>
            <div className="flex items-center gap-1">
              {intlMatchCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {intlMatchCount}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showInternationals && "rotate-180")} />
            </div>
          </button>
          {showInternationals && (
            <div className="mt-0.5 space-y-0.5">
              {/* Quick link to today's international games */}
              <Link
                href="/matches?category=international"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
              >
                <span className="text-sm">📅</span>
                <span>Today&apos;s Internationals</span>
                {intlMatchCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-orange-500">{intlMatchCount} games</span>
                )}
              </Link>
              {internationalLeagues.map(league => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.slug}`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <FlagIcon countryCode={league.countryCode} size="xs" />
                  <span className="truncate">{league.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top Bookmakers — collapsible with logos */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setShowBookmakers(!showBookmakers)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Wallet className="h-3 w-3 text-emerald-500" /> Top Bookmakers
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBookmakers && "rotate-180")} />
          </button>
          {showBookmakers && (
            <div className="mt-0.5 space-y-0.5">
              {SIDEBAR_BOOKMAKERS.map((bk) => (
                <Link
                  key={bk.slug}
                  href={`/bookmakers`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-sm border border-border bg-white">
                    <img
                      src={bk.logo}
                      alt={bk.name}
                      className="h-4 w-4 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <span className="truncate">{bk.name}</span>
                </Link>
              ))}
              <Link
                href="/bookmakers"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                View all bookmakers →
              </Link>
            </div>
          )}
        </div>

        {/* Admin — only visible for admin/moderator/editor users */}
        {isAuthenticated && user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'moderator' || user.role === 'editor') && (
          <div className="mt-auto border-t border-border p-2">
            <Link href="/admin" className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted rounded-md text-primary">
              <Settings className="h-3.5 w-3.5" />
              Admin Panel
            </Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="lg:pl-56">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card px-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden flex-1 max-w-md md:block">
            <HeaderSearch inline />
          </div>
          <div className="md:hidden">
            <HeaderSearch />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/bookmarks">
                <Bookmark className="h-4 w-4" />
              </Link>
            </Button>
            
            {isLoading ? (
              <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="hidden sm:inline">{user.displayName || user.username}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="p-2">
                    <p className="font-medium">{user.displayName || user.username}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    {user.balance !== undefined && (
                      <p className="mt-1 font-mono text-sm text-success">
                        KES {user.balance?.toLocaleString() || '0'}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/tips">My Tips</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/wallet">Wallet</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(user.role === 'admin' || user.role === 'super_admin' || user.role === 'moderator' || user.role === 'editor') && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="text-primary">
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openAuthModal('login')}>
                  Login
                </Button>
                <Button
                  size="sm"
                  className="hidden md:flex gap-2"
                  onClick={() => openAuthModal('register')}
                >
                  <LogIn className="h-4 w-4" />
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="pb-20 md:pb-0">{children}</main>

        <Footer />
        <BottomNav />
        <CookieBanner />
      </div>
    </div>
  )
}
