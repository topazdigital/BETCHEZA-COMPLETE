'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { User, ChevronDown, Settings, LogOut, Menu, X, Bookmark, Globe, Trophy, Download } from 'lucide-react';
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
import { useSiteSettings } from '@/lib/hooks/use-site-settings';
import type { OddsFormat } from '@/lib/types';

const oddsFormats: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'fractional', label: 'Fractional' },
  { value: 'american', label: 'American' },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALLED_KEY = 'bcz_app_installed_v1';
const _DISMISS_KEY  = 'bcz_install_dismiss_perm_v1'; void _DISMISS_KEY;
const WC_BANNER_DISMISSED_KEY = 'bcz_wc2026_v2_dismissed';

// FIFA World Cup 2026 opening — June 11 2026 19:00 EAT (UTC+3)
const WC_START_MS = new Date('2026-06-11T16:00:00Z').getTime();

function pad(n: number) { return String(n).padStart(2, '0'); }

function useCountdown(targetMs: number) {
  const [diff, setDiff] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    if (diff <= 0) return;
    const id = setInterval(() => {
      const d = Math.max(0, targetMs - Date.now());
      setDiff(d);
      if (d === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs, diff]);
  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;
  return { days, hours, mins, secs, done: diff === 0 };
}

export function WorldCupBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { days, hours, mins, secs, done } = useCountdown(WC_START_MS);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(WC_BANNER_DISMISSED_KEY)) setDismissed(true);
    } catch {}
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(WC_BANNER_DISMISSED_KEY, '1'); } catch {}
  };

  if (!mounted || dismissed || done) return null;

  const units = [
    { v: days,  l: 'Days' },
    { v: hours, l: 'Hours' },
    { v: mins,  l: 'Mins' },
    { v: secs,  l: 'Secs' },
  ];

  return (
    <div className="relative w-full overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #001a6e 0%, #c8102e 45%, #006b3f 100%)' }}>
      {/* Animated shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)',
          animation: 'wcShimmer 3s ease-in-out infinite',
        }}
      />
      {/* Subtle star particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[10,25,40,55,70,85].map((left, i) => (
          <span
            key={i}
            className="absolute text-white/20 text-[8px]"
            style={{ left: `${left}%`, top: `${(i % 3) * 30 + 10}%`, animationDelay: `${i * 0.4}s`, animation: 'wcTwinkle 2s ease-in-out infinite alternate' }}
          >★</span>
        ))}
      </div>

      <Link
        href="/competitions"
        className="mx-auto flex max-w-7xl items-center justify-center flex-wrap gap-x-4 gap-y-1 px-6 py-2 text-center"
      >
        {/* Trophy + title */}
        <div className="flex items-center gap-2">
          <span className="text-xl drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.8))', animation: 'wcPulse 2s ease-in-out infinite' }}>🏆</span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-300/90">FIFA</span>
            <span className="text-[13px] font-black uppercase tracking-wide leading-none">World Cup 2026</span>
          </div>
        </div>

        {/* Host flags */}
        <div className="hidden sm:flex items-center gap-1.5 text-sm">
          <span title="USA">🇺🇸</span>
          <span className="text-white/30 text-[10px]">·</span>
          <span title="Mexico">🇲🇽</span>
          <span className="text-white/30 text-[10px]">·</span>
          <span title="Canada">🇨🇦</span>
        </div>

        {/* Countdown blocks */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/60 mr-1 hidden md:inline font-medium">Kicks off in</span>
          {units.map(({ v, l }, i) => (
            <div key={l} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-white/25 font-bold text-base leading-none mb-2">:</span>}
              <div className="flex flex-col items-center">
                <div
                  suppressHydrationWarning
                  className="min-w-[34px] rounded-md px-1.5 py-1 text-center font-mono text-base font-black tabular-nums leading-none"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)', textShadow: '0 0 8px rgba(255,255,255,0.5)' }}
                >
                  {pad(v)}
                </div>
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-widest text-white/50">{l}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — always visible */}
        <div
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-black whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #ffd700, #ffaa00)', boxShadow: '0 0 12px rgba(255,200,0,0.6)' }}
        >
          🏆 <span className="hidden xs:inline">Win </span>KES 50,000 Prize →
        </div>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); dismiss(); }}
        aria-label="Dismiss World Cup banner"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:bg-white/20 hover:text-white transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { settings, setOddsFormat } = useUserSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: siteData } = useSiteSettings();
  const deferredInstall = useRef<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS only
      window.navigator.standalone === true;
    if (standalone) return;
    try {
      if (localStorage.getItem(INSTALLED_KEY)) return;
    } catch {}
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredInstall.current = e as BeforeInstallPromptEvent;
      setShowInstallBtn(true);
    };
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
      setShowInstallBtn(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const evt = deferredInstall.current;
    if (!evt) return;
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === 'accepted') {
        try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
        setShowInstallBtn(false);
      }
    } catch {}
    deferredInstall.current = null;
  };
  const branding = {
    siteName: siteData?.siteName || 'Betcheza',
    logoUrl: siteData?.logoUrl || '',
    logoDarkUrl: siteData?.logoDarkUrl || '',
  };

  return (
    <div className="sticky top-0 z-50 w-full">
      {/* World Cup 2026 countdown banner */}
      <WorldCupBanner />

      <header className="w-full border-b border-border bg-card">
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
                <img
                  src="/app-icon.png"
                  alt={branding.siteName}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="font-bold text-foreground text-base tracking-tight">
                  <span className="text-primary">B</span>etcheza
                </span>
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
            <Link href="/tips" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Tips
            </Link>
            <Link href="/tipsters" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Tipsters
            </Link>
            <Link href="/leaderboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Leaderboard
            </Link>
            <Link
              href="/competitions"
              className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Competitions
              {/* WC pill indicator */}
              <span className="absolute -top-1.5 -right-5 rounded-full bg-[#c8102e] px-1 py-px text-[7px] font-black uppercase text-white leading-none">
                WC
              </span>
            </Link>
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Prominent Install App button */}
            {showInstallBtn && (
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="hidden sm:flex gap-1.5 h-8 px-3 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
              >
                <Download className="h-3.5 w-3.5" />
                Install App
              </Button>
            )}

            {/* Search */}
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
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground overflow-hidden">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          user.displayName.charAt(0).toUpperCase()
                        )}
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
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/referral">
                        Refer &amp; Earn
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
                {/* Quick Google sign-in */}
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
                  { href: '/competitions', label: '🏆 Competitions (World Cup)' },
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
    </div>
  );
}
