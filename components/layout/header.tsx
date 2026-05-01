'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { User, ChevronDown, Settings, LogOut, Menu, X, Bookmark, Globe, Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeaderSearch } from '@/components/layout/header-search';
import { NotificationBell } from '@/components/layout/notification-bell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatOdds } from '@/lib/utils/odds-converter';
import type { OddsFormat } from '@/lib/types';

const oddsFormats: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'fractional', label: 'Fractional' },
  { value: 'american', label: 'American' },
];

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { settings, setOddsFormat } = useUserSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [branding, setBranding] = useState<{ siteName: string; logoUrl: string; logoDarkUrl: string }>({
    siteName: 'Betcheza',
    logoUrl: '',
    logoDarkUrl: '',
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/site-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d) return;
        setBranding({
          siteName: d.siteName || 'Betcheza',
          logoUrl: d.logoUrl || '',
          logoDarkUrl: d.logoDarkUrl || '',
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {branding.logoUrl ? (
            <>
              <img
                src={branding.logoUrl}
                alt={branding.siteName}
                className={`h-8 w-auto object-contain ${branding.logoDarkUrl ? 'block dark:hidden' : ''}`}
              />
              {branding.logoDarkUrl && (
                <img
                  src={branding.logoDarkUrl}
                  alt={branding.siteName}
                  className="hidden h-8 w-auto object-contain dark:block"
                />
              )}
            </>
          ) : (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="font-mono text-lg font-bold text-primary-foreground">{branding.siteName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="hidden font-semibold text-foreground sm:inline">{branding.siteName}</span>
            </>
          )}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/matches" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Matches
          </Link>
          <Link href="/results" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Results
          </Link>
          <Link href="/feed" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Feed
          </Link>
          <Link href="/tipsters" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Tipsters
          </Link>
          <Link href="/leaderboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/competitions" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Competitions
          </Link>
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Search — typeahead across matches, leagues, teams, tipsters */}
          <div className="relative hidden sm:block">
            <HeaderSearch />
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Odds Format Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden gap-1 sm:flex">
                <span className="font-mono text-xs">{formatOdds(1.85, settings.oddsFormat)}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {oddsFormats.map((format) => (
                <DropdownMenuItem
                  key={format.value}
                  onClick={() => setOddsFormat(format.value)}
                  className={settings.oddsFormat === format.value ? 'bg-accent' : ''}
                >
                  <span className="mr-2 font-mono text-sm">{formatOdds(1.85, format.value)}</span>
                  {format.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isAuthenticated && user ? (
            <>
              {/* Real-time Notification Bell */}
              <NotificationBell />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline">{user.displayName}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="p-2">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    <p className="mt-1 font-mono text-sm text-success">
                      KES {user.balance.toLocaleString()}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/bookmarks">
                      <Bookmark className="mr-2 h-4 w-4" />
                      My Bookmarks
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
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="text-primary">
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {/* Quick Google sign-in — one click away in the header */}
              <button
                type="button"
                title="Continue with Google"
                onClick={() => {
                  const next = typeof window !== 'undefined'
                    ? window.location.pathname + window.location.search
                    : '/';
                  window.location.href = `/api/auth/oauth/google/start?next=${encodeURIComponent(next)}`;
                }}
                className="hidden h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted sm:inline-flex"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.227c1.886-1.736 2.986-4.295 2.986-7.351z" fill="#4285F4"/>
                  <path d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.227-2.51c-.895.6-2.04.954-3.391.954-2.604 0-4.81-1.76-5.6-4.122H3.067v2.591A9.997 9.997 0 0 0 12 22z" fill="#34A853"/>
                  <path d="M6.4 13.9a6.013 6.013 0 0 1 0-3.8V7.51H3.067a10.005 10.005 0 0 0 0 8.98L6.4 13.9z" fill="#FBBC05"/>
                  <path d="M12 5.977c1.469 0 2.786.504 3.823 1.495l2.864-2.864C16.964 2.99 14.7 2 12 2A9.997 9.997 0 0 0 3.067 7.51L6.4 10.1c.79-2.36 2.996-4.123 5.6-4.123z" fill="#EA4335"/>
                </svg>
                <span className="hidden lg:inline">Google</span>
              </button>
              <Button variant="ghost" size="sm" onClick={() => openAuthModal('login')}>
                Login
              </Button>
              <Button size="sm" onClick={() => openAuthModal('register')}>
                Sign Up
              </Button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="max-h-[80vh] overflow-y-auto border-t border-border bg-card md:hidden">
          <div className="p-3">
            {/* Main nav links */}
            <nav className="flex flex-col gap-0.5">
              {[
                { href: '/matches', label: 'Matches' },
                { href: '/results', label: 'Results' },
                { href: '/feed', label: 'Feed' },
                { href: '/tipsters', label: 'Tipsters' },
                { href: '/leaderboard', label: 'Leaderboard' },
                { href: '/competitions', label: 'Competitions' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/predictor"
                className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                ✨ AI Predictor
              </Link>
              <Link
                href="/become-tipster"
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Become a Tipster
              </Link>
            </nav>

            {/* Popular Leagues */}
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-3 w-3" />
                Popular Leagues
              </p>
              <nav className="flex flex-col gap-0.5">
                {[
                  { href: '/leagues/premier-league', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'Premier League' },
                  { href: '/leagues/la-liga', flag: '🇪🇸', label: 'La Liga' },
                  { href: '/leagues/bundesliga', flag: '🇩🇪', label: 'Bundesliga' },
                  { href: '/leagues/serie-a', flag: '🇮🇹', label: 'Serie A' },
                  { href: '/leagues/ligue-1', flag: '🇫🇷', label: 'Ligue 1' },
                ].map(({ href, flag, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>{flag}</span>
                    <span>{label}</span>
                  </Link>
                ))}
                <Link
                  href="/leagues"
                  className="rounded-md px-3 py-1.5 text-xs text-primary hover:bg-accent"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  View all leagues →
                </Link>
              </nav>
            </div>

            {/* Internationals */}
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Globe className="h-3 w-3" />
                Internationals Today
              </p>
              <nav className="flex flex-col gap-0.5">
                {[
                  { href: '/leagues/uefa-champions-league', flag: '⭐', label: 'Champions League' },
                  { href: '/leagues/uefa-europa-league', flag: '🌍', label: 'Europa League' },
                  { href: '/leagues/uefa-conference-league', flag: '🏆', label: 'Conference League' },
                  { href: '/leagues/caf-champions-league', flag: '🌍', label: 'CAF Champions League' },
                ].map(({ href, flag, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>{flag}</span>
                    <span>{label}</span>
                  </Link>
                ))}
                <Link
                  href="/matches?type=international"
                  className="rounded-md px-3 py-1.5 text-xs text-primary hover:bg-accent"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  All internationals →
                </Link>
              </nav>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
