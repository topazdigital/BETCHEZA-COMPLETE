'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import dynamicImport from 'next/dynamic';
import {
  BarChart3, TrendingUp, Trophy, Target, Globe,
  Smartphone, Mail, MessageCircle, CheckCircle2, Zap,
  Star, Shield, DollarSign, Eye, MousePointer,
  Radio, Calendar, Award, MapPin, Clock, Megaphone,
  ChevronRight, Handshake, LayoutDashboard, PieChart,
  BadgeCheck, Flame, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SidebarBanners = dynamicImport(
  () => import('@/components/home/sidebar-banners').then(m => ({ default: m.SidebarBanners })),
  { ssr: false, loading: () => null },
);

interface AdvertiseStats {
  totalTips: number | null;
  overallWinRate: number | null;
  monthlyPageviews: number | null;
  avgSessionMinutes: number | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

function StatCard({ icon: Icon, value, label, sub, color = 'text-primary', bg = 'bg-primary/10', border = 'border-primary/20' }: {
  icon: typeof Eye; value: string; label: string; sub?: string;
  color?: string; bg?: string; border?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-3 bg-card', border)}>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-2', bg)}>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function PackageCard({ name, price, features, highlight, badge }: {
  name: string; price: string; features: string[]; highlight?: boolean; badge?: string;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3',
      highlight ? 'border-primary bg-primary/5 relative' : 'border-border bg-card'
    )}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground whitespace-nowrap">
          {badge}
        </span>
      )}
      <div>
        <p className="font-bold text-sm text-foreground">{name}</p>
        <p className={cn('text-lg font-extrabold mt-0.5', highlight ? 'text-primary' : 'text-foreground')}>{price}</p>
        <p className="text-[11px] text-muted-foreground">per month</p>
      </div>
      <ul className="space-y-1.5 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="mailto:partnerships@betcheza.co.ke?subject=Advertising%20Enquiry%20-%20Betcheza"
        className={cn(
          'w-full rounded-lg py-2 text-center text-xs font-semibold transition-colors',
          highlight
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border border-border bg-card hover:bg-muted text-foreground'
        )}
      >
        Get in touch
      </a>
    </div>
  );
}

function DemographicBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground font-mono">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ── LEFT SIDEBAR — demographics & deals ───────────────────── */
function AdvertiseLeftSidebar() {
  return (
    <div className="space-y-3">

      {/* Audience Demographics */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <PieChart className="h-3.5 w-3.5 text-blue-500" />
          Audience Demographics
        </p>

        {/* Geography */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="h-3 w-3 text-green-500" />
            <span className="text-[11px] font-semibold text-foreground">Geography</span>
          </div>
          <div className="space-y-1.5">
            <DemographicBar label="Kenya" percent={78} color="bg-green-500" />
            <DemographicBar label="East Africa" percent={93} color="bg-emerald-400" />
            <DemographicBar label="Uganda" percent={6} color="bg-blue-400" />
            <DemographicBar label="Tanzania" percent={5} color="bg-cyan-400" />
            <DemographicBar label="Other" percent={7} color="bg-muted-foreground/40" />
          </div>
        </div>

        {/* Age */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="h-3 w-3 text-purple-500" />
            <span className="text-[11px] font-semibold text-foreground">Age Breakdown</span>
          </div>
          <div className="space-y-1.5">
            {([['18–24', 31, 'bg-violet-400'], ['25–34', 44, 'bg-purple-500'], ['35–44', 18, 'bg-indigo-400'], ['45+', 7, 'bg-slate-400']] as const).map(([range, pct, clr]) => (
              <DemographicBar key={range} label={`Age ${range}`} percent={pct} color={clr} />
            ))}
          </div>
        </div>

        {/* Device */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Smartphone className="h-3 w-3 text-orange-500" />
            <span className="text-[11px] font-semibold text-foreground">Device Split</span>
          </div>
          <div className="space-y-1.5">
            <DemographicBar label="Mobile" percent={87} color="bg-orange-500" />
            <DemographicBar label="Desktop/Tablet" percent={13} color="bg-orange-300" />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">Ads shown on the same device users bet from.</p>
        </div>

        {/* Sports Interest */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Radio className="h-3 w-3 text-red-500" />
            <span className="text-[11px] font-semibold text-foreground">Sports Interest</span>
          </div>
          <div className="space-y-1.5">
            {([
              ['Football', 74, 'bg-red-500'],
              ['Basketball', 9, 'bg-amber-500'],
              ['Tennis', 7, 'bg-lime-500'],
              ['Rugby', 5, 'bg-teal-500'],
              ['Other', 5, 'bg-slate-400'],
            ] as const).map(([sport, pct, clr]) => (
              <DemographicBar key={sport} label={sport} percent={pct} color={clr} />
            ))}
          </div>
        </div>
      </div>

      {/* Deal Structures */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-emerald-500" />
          Deal Structures
        </p>
        <div className="space-y-2">
          {[
            { tag: 'CPA', desc: 'KES 1,500–5,000 per depositing player', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
            { tag: 'Rev Share', desc: 'Min. 30% NGR · lifetime attribution', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
            { tag: 'Hybrid', desc: 'Lower CPA + ongoing rev share', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
          ].map(({ tag, desc, color }) => (
            <div key={tag} className="flex items-start gap-2">
              <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold', color)}>{tag}</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why Advertise */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          Why Advertise Here
        </p>
        <ul className="space-y-1.5">
          {[
            'Verified, real bettors only',
            '87% mobile-first audience',
            "Kenya's #1 tips platform",
            'Match-day traffic spikes 3–5×',
            'Transparent reporting',
            'CPA, Rev Share or Fixed',
          ].map(item => (
            <li key={item} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Limited slots urgency */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
        <div className="flex items-start gap-2">
          <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">Limited ad slots</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Jackpot page &amp; homepage banner have just 1 slot each. Contact us to check availability.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── RIGHT SIDEBAR ─────────────────────────────────────────── */
function AdvertiseRightSidebar({ stats, loading }: { stats: AdvertiseStats | null; loading: boolean }) {
  const s = stats;
  return (
    <div className="space-y-3">

      {/* Live stats mini-card */}
      <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-green-600">Live Platform Stats</span>
        </div>
        <div className="space-y-2.5">
          {[
            { label: 'Monthly Pageviews', value: loading ? '…' : s?.monthlyPageviews != null ? fmt(s.monthlyPageviews) : '—', icon: Eye, color: 'text-purple-500' },
            { label: 'Tips on Platform', value: loading ? '…' : s?.totalTips != null ? fmt(s.totalTips) : '—', icon: Target, color: 'text-pink-500' },
            { label: 'Avg. Session Time', value: loading ? '…' : s?.avgSessionMinutes != null ? `${s.avgSessionMinutes}m` : '—', icon: Clock, color: 'text-orange-500' },
            { label: 'Platform Win Rate', value: loading ? '…' : s?.overallWinRate != null ? `${s.overallWinRate}%` : '—', icon: Star, color: 'text-green-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick packages */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          Packages at a Glance
        </p>
        <div className="space-y-2">
          {[
            { name: 'Starter', price: 'KES 25K/mo', highlight: false },
            { name: 'Growth', price: 'KES 60K/mo', highlight: true },
            { name: 'Premium', price: 'Custom', highlight: false },
          ].map(({ name, price, highlight }) => (
            <div key={name} className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-xs',
              highlight ? 'bg-primary/10 border border-primary/25' : 'bg-muted/50'
            )}>
              <span className={cn('font-semibold', highlight ? 'text-primary' : 'text-foreground')}>{name}</span>
              <span className={cn('font-bold tabular-nums', highlight ? 'text-primary' : 'text-muted-foreground')}>{price}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">VAT excl. · contact for custom quotes</p>
      </div>

      {/* CTA card */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 to-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Book a Partnership</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          Get our media kit, audience data pack, and a custom proposal within 24 hours.
        </p>
        <a
          href="mailto:partnerships@betcheza.co.ke?subject=Advertising%20Enquiry%20-%20Betcheza&body=Hi%20Betcheza%20Partnerships%20Team%2C%0A%0AI%20am%20interested%20in%20advertising%20on%20Betcheza.%20Please%20send%20me%20your%20media%20kit.%0A%0ACompany%3A%20%0AWebsite%3A%20%0AMonthly%20budget%3A%20%0AModel%20preferred%20(CPA%2FRevShare%2FFixed)%3A%20%0A%0AThanks"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors mb-2"
        >
          <Mail className="h-3.5 w-3.5" />
          Email partnerships team
        </a>
        <a
          href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I'm%20interested%20in%20advertising%20on%20your%20platform.%20Please%20send%20me%20your%20media%20kit."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-green-500/40 bg-green-500/10 py-2 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp only (no calls)
        </a>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */

export default function AdvertisePage() {
  const [stats, setStats] = useState<AdvertiseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/advertise/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));

    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  const s = stats;

  const statCards = [
    {
      icon: Eye,
      value: loading ? '…' : s?.monthlyPageviews != null ? fmt(s.monthlyPageviews) : '—',
      label: 'Monthly Pageviews',
      sub: s?.monthlyPageviews != null ? 'Rolling 30 days' : 'Tracking active',
      color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20',
    },
    {
      icon: Target,
      value: loading ? '…' : s?.totalTips != null ? fmt(s.totalTips) : '—',
      label: 'Tips Posted',
      sub: 'All-time predictions',
      color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20',
    },
    {
      icon: Clock,
      value: loading ? '…' : s?.avgSessionMinutes != null ? `${s.avgSessionMinutes}m` : '—',
      label: 'Avg. Session Time',
      sub: s?.avgSessionMinutes != null ? 'High intent audience' : 'Analytics pending',
      color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20',
    },
    {
      icon: Star,
      value: loading ? '…' : s?.overallWinRate != null ? `${s.overallWinRate}%` : '—',
      label: 'Platform Win Rate',
      sub: s?.overallWinRate != null ? 'Settled tips' : 'No settled tips yet',
      color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20',
    },
  ];

  return (
    <div className="flex min-h-screen w-full">

      {/* ── LEFT SIDEBAR — demographics & deals (lg+) ─────── */}
      <aside className="hidden lg:block w-56 xl:w-60 shrink-0 border-r border-border">
        <div className="sticky top-14 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <AdvertiseLeftSidebar />
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="px-3 py-3 sm:px-4 sm:py-4 space-y-4 max-w-2xl">

          {/* HERO */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Advertise on Betcheza</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 leading-tight">
              Kenya's sports betting tips platform —{' '}
              <span className="text-primary">reach bettors who are ready to bet</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Betcheza is Kenya's leading sports predictions community. Place your brand in front of a highly engaged, mobile-first audience actively searching for bookmakers, odds, and betting insights.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { label: 'Live Stats', href: '#stats' },
                { label: 'Ad Placements', href: '#placements' },
                { label: 'Packages', href: '#packages' },
                { label: 'Contact Us', href: '#contact' },
              ].map(l => (
                <a key={l.href} href={l.href} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          {/* LIVE STATISTICS */}
          <section id="stats" className="scroll-mt-16">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-600">Live Platform Statistics</span>
            </div>
            <h2 className="text-sm font-bold text-foreground mb-0.5">Real numbers, no inflated claims</h2>
            <p className="text-xs text-muted-foreground mb-3">Figures pulled directly from our platform database in real time.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {statCards.map(c => (
                <StatCard key={c.label} icon={c.icon} value={c.value} label={c.label} sub={c.sub} color={c.color} bg={c.bg} border={c.border} />
              ))}
            </div>
          </section>

          {/* AD PLACEMENTS */}
          <section id="placements" className="scroll-mt-16">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <LayoutDashboard className="h-3.5 w-3.5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Ad Placements Available</h2>
                <p className="text-xs text-muted-foreground">High-visibility positions across the platform</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              {[
                {
                  title: 'Homepage Banner', icon: Eye,
                  color: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5',
                  desc: 'Top-of-page banner — first thing every visitor sees.',
                  specs: ['Desktop: 1200×120px', 'Mobile: 375×80px', 'Link-through to your site/offer'],
                },
                {
                  title: 'Match Pages — Bookmaker Card', icon: Trophy,
                  color: 'text-green-600', border: 'border-green-500/20', bg: 'bg-green-500/5',
                  desc: 'Featured on every match page alongside odds — shown when users decide where to bet.',
                  specs: ['Highest-intent placement', 'Logo + offer text + CTA', 'Next to odds comparison'],
                },
                {
                  title: 'In-Feed Sponsored Tips', icon: TrendingUp,
                  color: 'text-purple-500', border: 'border-purple-500/20', bg: 'bg-purple-500/5',
                  desc: 'Native sponsored cards in the Community Feed and Tipsters pages.',
                  specs: ['Native format — blends with content', 'Logo + tip text + CTA', 'Sponsored label for compliance'],
                },
                {
                  title: 'Jackpot Page — Exclusive Sponsor', icon: Star,
                  color: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5',
                  desc: 'Exclusive sponsor of Jackpots page — peak excitement traffic.',
                  specs: ['Full-width top banner', 'Your jackpot listed prominently', '⚠️ Only 1 slot available'],
                },
                {
                  title: 'Email Newsletter', icon: Mail,
                  color: 'text-rose-500', border: 'border-rose-500/20', bg: 'bg-rose-500/5',
                  desc: 'Your offer in our weekly tips newsletter, sent every Monday.',
                  specs: ['Opted-in subscribers only', 'Logo + headline + offer link'],
                },
              ].map(({ title, icon: Icon, color, border, bg, desc, specs }) => (
                <div key={title} className={cn('rounded-xl border p-3', border, bg)}>
                  <div className="flex items-start gap-2 mb-1.5">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', color)} />
                    <div>
                      <p className={cn('text-xs font-semibold', color)}>{title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {specs.map(sp => (
                      <span key={sp} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                        {sp}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PACKAGES */}
          <section id="packages" className="scroll-mt-16">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                <DollarSign className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Advertising Packages</h2>
                <p className="text-xs text-muted-foreground">Fixed monthly placements — contact us for a custom quote</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-2">
              <PackageCard
                name="Starter" price="KES 25,000"
                features={[
                  'Homepage banner (mobile)',
                  'Bookmaker card — 5 match pages/day',
                  'Monthly performance report',
                  '1-month minimum commitment',
                ]}
              />
              <PackageCard
                name="Growth" price="KES 60,000"
                badge="Most Popular" highlight
                features={[
                  'Homepage banner (desktop + mobile)',
                  'Bookmaker card — all match pages',
                  '2× in-feed sponsored tips/week',
                  'Email newsletter inclusion',
                  'Dedicated account manager',
                  'Monthly performance report',
                ]}
              />
              <PackageCard
                name="Premium" price="Custom"
                features={[
                  'All Growth features',
                  'Jackpot page exclusive sponsorship',
                  'Weekly in-feed sponsored tips',
                  'Logo on AI Predictor page',
                  'Push notification sponsorship',
                  'Co-branded challenge',
                  'Quarterly strategy review',
                ]}
              />
            </div>

            <p className="mt-3 text-xs rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 leading-relaxed text-muted-foreground">
              <strong className="text-amber-700 dark:text-amber-400">Note:</strong> All packages can be combined with CPA or Revenue Share. Prices KES per month, VAT exclusive.
            </p>
          </section>

          {/* WHY BETCHEZA */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Why advertise on Betcheza?</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                { icon: Target, label: 'Verified bettors only', desc: 'Every user has registered and verified — no bots.' },
                { icon: Smartphone, label: 'Mobile-first', desc: '87% mobile — ads shown on the same device users bet from.' },
                { icon: Globe, label: 'Kenya market', desc: "Strong presence in Kenya, East Africa's largest betting market." },
                { icon: BarChart3, label: 'Transparent reporting', desc: 'Full impression, click and conversion reporting.' },
                { icon: Calendar, label: 'Match-day peaks', desc: 'Traffic spikes 3–5× on match days — maximum intent.' },
                { icon: Zap, label: 'Growing platform', desc: 'Consistent growth with engaged community of tipsters.' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CONTACT */}
          <section id="contact" className="scroll-mt-16">
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Handshake className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Get in Touch</span>
              </div>
              <h2 className="text-base font-bold text-foreground mb-1">Ready to partner with us?</h2>
              <p className="text-xs text-muted-foreground mb-4 max-w-lg">
                Contact our partnerships team for a media kit, audience data pack, or to discuss a tailored deal. We respond within 24 hours.
              </p>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <a
                  href="mailto:partnerships@betcheza.co.ke?subject=Advertising%20Enquiry%20-%20Betcheza&body=Hi%20Betcheza%20Partnerships%20Team%2C%0A%0AI%20am%20interested%20in%20advertising%20on%20Betcheza.%20Please%20send%20me%20your%20media%20kit.%0A%0ACompany%3A%20%0AWebsite%3A%20%0AMonthly%20budget%3A%20%0AModel%20preferred%20(CPA%2FRevShare%2FFixed)%3A%20%0A%0AThanks"
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Email us</p>
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">partnerships@betcheza.co.ke</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Response within 24 hours</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I'm%20interested%20in%20advertising%20on%20your%20platform.%20Please%20send%20me%20your%20media%20kit."
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-card p-3 hover:border-green-500/60 hover:bg-green-500/5 transition-colors group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20">
                    <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">WhatsApp only (no calls)</p>
                    <p className="text-xs font-semibold text-foreground group-hover:text-green-600 transition-colors">+254 113 226 240</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Message us — no phone calls</p>
                  </div>
                </a>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[11px] text-muted-foreground mb-2">When you reach out, please include:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Your company name & website', 'Preferred partnership model', 'Monthly budget range', 'Target market / offer'].map(item => (
                    <span key={item} className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                      <ChevronRight className="h-3 w-3 text-primary" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border pt-3 pb-4">
            <Link href="/about" className="hover:text-foreground transition-colors">About Betcheza</Link>
            <Link href="/tipsters" className="hover:text-foreground transition-colors">Our Tipsters</Link>
            <Link href="/responsible-gambling" className="hover:text-foreground transition-colors">Responsible Gambling</Link>
          </div>

        </div>
      </div>

      {/* ── RIGHT SIDEBAR — desktop only ─────────────────── */}
      <aside className="hidden xl:block w-64 shrink-0 border-l border-border">
        <div className="sticky top-14 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <AdvertiseRightSidebar stats={stats} loading={loading} />
        </div>
      </aside>

    </div>
  );
}
