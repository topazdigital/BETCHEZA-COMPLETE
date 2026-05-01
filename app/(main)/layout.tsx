"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, Calendar, Trophy, Users, BarChart3, Radio, Bookmark,
  Menu, X, Search, Bell, Settings, LogIn, LogOut, ChevronDown,
  Star, Wallet, User, Sparkles, UserPlus
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

// ✅ FIX: import correct export and alias it
import { ALL_SPORTS as SPORTS_LIST, ALL_LEAGUES, getSportIcon } from "@/lib/sports-data"

const POPULAR_LEAGUE_IDS = [1, 2, 3, 4, 5]; // Premier League, La Liga, Bundesliga, Serie A, Ligue 1
const INTERNATIONAL_LEAGUE_IDS = [9, 10, 26, 102]; // UCL, UEL, UECL, CAF CL

const mainNavItems: Array<{ href: string; label: string; icon: typeof Home; badgeKey?: 'live' | 'today' }> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live", icon: Radio, badgeKey: 'live' },
  { href: "/matches", label: "Matches", icon: Calendar, badgeKey: 'today' },
  { href: "/predictor", label: "AI Predictor", icon: Sparkles },
  { href: "/tipsters", label: "Tipsters", icon: Users },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/competitions", label: "Competitions", icon: Star },
  { href: "/bookmakers", label: "Bookmakers", icon: Wallet },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/become-tipster", label: "Become a Tipster", icon: UserPlus },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isAuthenticated, logout, isLoading } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSports, setShowSports] = useState(true)
  const stats = useMatchStats()
  const [branding, setBranding] = useState<{ siteName: string; logoUrl: string; logoDarkUrl: string }>({
    siteName: "Betcheza",
    logoUrl: "",
    logoDarkUrl: "",
  })

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

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — narrower & denser. Whole sidebar scrolls so the full
          sports list is reachable without an inner scroll cap. */}
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
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
                  {branding.siteName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w.charAt(0).toUpperCase())
                    .join("")
                    .slice(0, 2) || "BZ"}
                </div>
                <span className="text-sm font-bold">{branding.siteName}</span>
              </>
            )}
          </Link>
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5 p-2">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="h-3.5 w-3.5" />
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

        {/* Popular Leagues */}
        <div className="border-t border-border p-2">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Popular Leagues
          </p>
          <div className="mt-0.5 space-y-0.5">
            {ALL_LEAGUES
              .filter(l => POPULAR_LEAGUE_IDS.includes(l.id))
              .sort((a, b) => POPULAR_LEAGUE_IDS.indexOf(a.id) - POPULAR_LEAGUE_IDS.indexOf(b.id))
              .map(league => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.slug}`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <span className="text-sm">🏆</span>
                  <span className="truncate">{league.name}</span>
                </Link>
              ))
            }
          </div>
        </div>

        {/* Internationals */}
        <div className="border-t border-border p-2">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Star className="h-3 w-3" /> Internationals
          </p>
          <div className="mt-0.5 space-y-0.5">
            {ALL_LEAGUES
              .filter(l => INTERNATIONAL_LEAGUE_IDS.includes(l.id))
              .sort((a, b) => INTERNATIONAL_LEAGUE_IDS.indexOf(a.id) - INTERNATIONAL_LEAGUE_IDS.indexOf(b.id))
              .map(league => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.slug}`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <span className="text-sm">🌍</span>
                  <span className="truncate">{league.name}</span>
                </Link>
              ))
            }
          </div>
        </div>

        {/* Admin - only visible for admin users */}
        {isAuthenticated && user?.role === 'admin' && (
          <div className="mt-auto border-t border-border p-2">
            <Link href="/admin" className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted rounded-md text-primary">
              <Settings className="h-3.5 w-3.5" />
              Admin Panel
            </Link>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="lg:pl-56">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card px-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden flex-1 max-w-md md:block">
            <HeaderSearch inline />
          </div>
          {/* Mobile: collapsed icon-button search keeps the header tidy. */}
          <div className="md:hidden">
            <HeaderSearch />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bookmark className="h-4 w-4" />
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
                    <Link href="/dashboard/tips">
                      My Tips
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/wallet">
                      Wallet
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user.role === 'admin' && (
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

        <main className="p-3 pb-20 md:p-4 md:pb-4">{children}</main>

        {/* Site footer (admin-managed branding + social links) */}
        <Footer />

        {/* Mobile Bottom Navigation */}
        <BottomNav />

        {/* Cookie consent banner (admin-toggleable) */}
        <CookieBanner />
      </div>
    </div>
  )
}
