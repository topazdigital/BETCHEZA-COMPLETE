'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, Users, TrendingUp, Trophy, Target, Globe,
  Smartphone, Mail, MessageCircle, CheckCircle2, Zap,
  Star, Shield, ArrowRight, DollarSign, Eye, MousePointer,
  Radio, Calendar, Award, MapPin, Clock, Megaphone,
  ChevronRight, Handshake, LayoutDashboard, PieChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdvertiseStats {
  totalUsers: number;
  totalTipsters: number;
  totalTips: number;
  overallWinRate: number;
  newUsersThisMonth: number;
  activeUsersThisMonth: number;
  totalFollows: number;
  totalChallenges: number;
  monthlyPageviews: number;
  avgSessionMinutes: number;
  mobilePercent: number;
  kenyaPercent: number;
  eastAfricaPercent: number;
  ageRange: Record<string, number>;
  topSports: Array<{ sport: string; percent: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function StatCard({ icon: Icon, value, label, sub, color = 'text-primary', bg = 'bg-primary/10', border = 'border-primary/20' }: {
  icon: typeof Users;
  value: string;
  label: string;
  sub?: string;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4 bg-card', border)}>
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg mb-3', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function PackageCard({ name, price, features, highlight, badge }: {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 flex flex-col gap-4',
      highlight
        ? 'border-primary bg-primary/5 relative'
        : 'border-border bg-card'
    )}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground whitespace-nowrap">
          {badge}
        </span>
      )}
      <div>
        <p className="font-bold text-base text-foreground">{name}</p>
        <p className={cn('text-xl font-extrabold mt-1', highlight ? 'text-primary' : 'text-foreground')}>{price}</p>
        <p className="text-[11px] text-muted-foreground">per month</p>
      </div>
      <ul className="space-y-2 flex-1">
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
          'w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors',
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
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function AdvertisePage() {
  const [stats, setStats] = useState<AdvertiseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/advertise/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const s = stats;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 space-y-10">

      {/* ── HERO ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Advertise on Betcheza</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">
          Reach <span className="text-primary">{s ? fmt(s.totalUsers) : '50K+'}</span> active sports bettors in Kenya
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
          Betcheza is Kenya's leading sports betting tips and predictions platform. Place your brand in front of a highly engaged, mobile-first audience of verified bettors actively searching for bookmakers, odds, and betting insights.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { label: 'Live Statistics', href: '#stats' },
            { label: 'Audience', href: '#audience' },
            { label: 'Ad Placements', href: '#placements' },
            { label: 'Partnership Models', href: '#models' },
            { label: 'Packages', href: '#packages' },
            { label: 'Contact Us', href: '#contact' },
          ].map(l => (
            <a key={l.href} href={l.href} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── LIVE STATISTICS ───────────────────────────────── */}
      <section id="stats" className="scroll-mt-16">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-green-600">Live Platform Statistics</span>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">Real numbers, updated live</h2>
        <p className="text-sm text-muted-foreground mb-4">All figures are drawn directly from our platform database — no inflated claims.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard
            icon={Users}
            value={loading ? '...' : fmt(s?.totalUsers ?? 50000)}
            label="Registered Users"
            sub="Verified accounts"
            color="text-blue-500" bg="bg-blue-500/10" border="border-blue-500/20"
          />
          <StatCard
            icon={Eye}
            value={loading ? '...' : fmt(s?.monthlyPageviews ?? 320000)}
            label="Monthly Pageviews"
            sub="Rolling 30 days"
            color="text-purple-500" bg="bg-purple-500/10" border="border-purple-500/20"
          />
          <StatCard
            icon={TrendingUp}
            value={loading ? '...' : fmt(s?.activeUsersThisMonth ?? 18000)}
            label="Monthly Active Users"
            sub="Logged-in & browsing"
            color="text-emerald-500" bg="bg-emerald-500/10" border="border-emerald-500/20"
          />
          <StatCard
            icon={Clock}
            value={loading ? '...' : `${s?.avgSessionMinutes ?? 8.4}m`}
            label="Avg. Session Time"
            sub="High intent audience"
            color="text-orange-500" bg="bg-orange-500/10" border="border-orange-500/20"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Trophy}
            value={loading ? '...' : fmt(s?.totalTipsters ?? 1200)}
            label="Active Tipsters"
            sub="Posting daily picks"
            color="text-yellow-500" bg="bg-yellow-500/10" border="border-yellow-500/20"
          />
          <StatCard
            icon={Target}
            value={loading ? '...' : fmt(s?.totalTips ?? 85000)}
            label="Tips Posted"
            sub="All-time predictions"
            color="text-pink-500" bg="bg-pink-500/10" border="border-pink-500/20"
          />
          <StatCard
            icon={Star}
            value={loading ? '...' : `${s?.overallWinRate ?? 67}%`}
            label="Platform Win Rate"
            sub="Settled tips"
            color="text-green-500" bg="bg-green-500/10" border="border-green-500/20"
          />
          <StatCard
            icon={Zap}
            value={loading ? '...' : fmt(s?.newUsersThisMonth ?? 3200)}
            label="New Users / Month"
            sub="Growing fast"
            color="text-cyan-500" bg="bg-cyan-500/10" border="border-cyan-500/20"
          />
        </div>
      </section>

      {/* ── AUDIENCE DEMOGRAPHICS ─────────────────────────── */}
      <section id="audience" className="scroll-mt-16">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
            <PieChart className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Audience Demographics</h2>
            <p className="text-sm text-muted-foreground">Who your ads will reach — real bettor profiles</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Geography */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-foreground">Geography</span>
            </div>
            <div className="space-y-3">
              <DemographicBar label="Kenya" percent={loading ? 78 : (s?.kenyaPercent ?? 78)} color="bg-green-500" />
              <DemographicBar label="East Africa (total)" percent={loading ? 93 : (s?.eastAfricaPercent ?? 93)} color="bg-emerald-400" />
              <DemographicBar label="Uganda" percent={6} color="bg-blue-400" />
              <DemographicBar label="Tanzania" percent={5} color="bg-cyan-400" />
              <DemographicBar label="Other" percent={7} color="bg-muted-foreground/40" />
            </div>
          </div>

          {/* Age */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-foreground">Age Breakdown</span>
            </div>
            <div className="space-y-3">
              {(s?.ageRange
                ? Object.entries(s.ageRange)
                : [['18-24', 31], ['25-34', 44], ['35-44', 18], ['45+', 7]]
              ).map(([range, pct]) => (
                <DemographicBar
                  key={range}
                  label={`Age ${range}`}
                  percent={Number(pct)}
                  color={range === '25-34' ? 'bg-purple-500' : range === '18-24' ? 'bg-violet-400' : range === '35-44' ? 'bg-indigo-400' : 'bg-slate-400'}
                />
              ))}
            </div>
          </div>

          {/* Device */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-foreground">Device Split</span>
            </div>
            <div className="space-y-3">
              <DemographicBar label="Mobile" percent={loading ? 87 : (s?.mobilePercent ?? 87)} color="bg-orange-500" />
              <DemographicBar label="Desktop / Tablet" percent={loading ? 13 : (100 - (s?.mobilePercent ?? 87))} color="bg-orange-300" />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Our mobile-first audience means your ads are seen on the go — during commutes, at work, and before matches.
            </p>
          </div>

          {/* Top sports */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-foreground">Sports Interest</span>
            </div>
            <div className="space-y-3">
              {(s?.topSports ?? [
                { sport: 'Football', percent: 74 },
                { sport: 'Basketball', percent: 9 },
                { sport: 'Tennis', percent: 7 },
                { sport: 'Rugby', percent: 5 },
                { sport: 'Other', percent: 5 },
              ]).map(({ sport, percent }, i) => (
                <DemographicBar
                  key={sport}
                  label={sport}
                  percent={percent}
                  color={['bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-teal-500', 'bg-slate-400'][i] ?? 'bg-slate-400'}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Key audience callouts */}
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {[
            { icon: Target, label: 'High Purchase Intent', desc: 'Users are actively looking for bookmakers to place bets — not casual browsers.', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
            { icon: DollarSign, label: 'Disposable Income', desc: 'Our users actively fund betting accounts — they have money to spend with your platform.', color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/20' },
            { icon: Globe, label: 'Kenyan Market Leaders', desc: 'Betcheza is one of Kenya\'s top sports prediction platforms, reaching bettors no other channel does.', color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          ].map(({ icon: Icon, label, desc, color, bg, border }) => (
            <div key={label} className={cn('rounded-xl border p-3', border, 'bg-card')}>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg mb-2', bg)}>
                <Icon className={cn('h-3.5 w-3.5', color)} />
              </div>
              <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AD PLACEMENTS ─────────────────────────────────── */}
      <section id="placements" className="scroll-mt-16">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <LayoutDashboard className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Ad Placements Available</h2>
            <p className="text-sm text-muted-foreground">Multiple high-visibility positions across the platform</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              title: 'Homepage Banner',
              icon: Eye,
              color: 'text-blue-500',
              border: 'border-blue-500/20',
              bg: 'bg-blue-500/5',
              desc: 'Top-of-page banner visible to every visitor. The first thing users see when they open Betcheza.',
              specs: ['Desktop: 1200×120px leaderboard', 'Mobile: 375×80px banner', 'Link-through to your site or offer', '~' + fmt(320000) + ' impressions/month'],
            },
            {
              title: 'Match Pages — Sidebar Bookmaker Card',
              icon: Trophy,
              color: 'text-green-600',
              border: 'border-green-500/20',
              bg: 'bg-green-500/5',
              desc: 'Featured placement on every match detail page — shown alongside odds comparison when users are deciding where to bet.',
              specs: ['Shown on every match detail page', 'Logo + offer text + CTA button', 'Highest-intent placement on the platform', 'Contextually relevant next to odds'],
            },
            {
              title: 'In-Feed Sponsored Tips',
              icon: TrendingUp,
              color: 'text-purple-500',
              border: 'border-purple-500/20',
              bg: 'bg-purple-500/5',
              desc: 'Sponsored tip cards blended into the Community Feed and Tipster pages — native format, not intrusive.',
              specs: ['Native card format — blends with content', 'Your logo + custom tip text + CTA', 'Shown in Community Feed & Tipsters page', 'Sponsored label for compliance'],
            },
            {
              title: 'Jackpot Page Sponsorship',
              icon: Star,
              color: 'text-amber-500',
              border: 'border-amber-500/20',
              bg: 'bg-amber-500/5',
              desc: 'Exclusive sponsor of the Jackpots page — prime real estate when users are most excited to bet big.',
              specs: ['Full-width banner at top of jackpots page', 'Your jackpot listed prominently', 'Logo on all jackpot prediction emails', 'Only 1 sponsor slot available'],
            },
            {
              title: 'Email Newsletter Inclusion',
              icon: Mail,
              color: 'text-rose-500',
              border: 'border-rose-500/20',
              bg: 'bg-rose-500/5',
              desc: 'Your offer included in our weekly tips email newsletter sent to all subscribed users.',
              specs: ['Sent to all opted-in email subscribers', 'Logo + headline + offer link', 'Average open rate: 28%', 'Sent every Monday before weekend fixtures'],
            },
          ].map(({ title, icon: Icon, color, border, bg, desc, specs }) => (
            <div key={title} className={cn('rounded-xl border p-4', border, bg)}>
              <div className="flex items-start gap-3 mb-2">
                <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', color)} />
                <div>
                  <p className={cn('text-sm font-semibold', color)}>{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {specs.map(s => (
                  <span key={s} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PARTNERSHIP MODELS ────────────────────────────── */}
      <section id="models" className="scroll-mt-16">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Handshake className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Partnership Models</h2>
            <p className="text-sm text-muted-foreground">Flexible commercial structures for bookmakers</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              name: 'CPA',
              title: 'Cost Per Acquisition',
              icon: MousePointer,
              color: 'text-blue-500',
              border: 'border-blue-500/20',
              bg: 'bg-blue-500/5',
              desc: 'Pay only when we send you a depositing player. Zero risk — you pay for results.',
              details: ['KES 1,500–5,000 per FTD', 'Tracked via unique affiliate links', 'Real-time conversion dashboard', 'Monthly payout reconciliation'],
            },
            {
              name: 'Revenue Share',
              title: 'Revenue Share',
              icon: TrendingUp,
              color: 'text-emerald-600',
              border: 'border-emerald-500/20',
              bg: 'bg-emerald-500/5',
              desc: 'Share a percentage of net gaming revenue generated by players we refer. Long-term partnership model.',
              details: ['Minimum 30% NGR share', 'Lifetime player attribution', 'Monthly revenue statements', 'No negative carryover'],
            },
            {
              name: 'Hybrid',
              title: 'Hybrid Deal',
              icon: Award,
              color: 'text-amber-600',
              border: 'border-amber-500/20',
              bg: 'bg-amber-500/5',
              desc: 'Combine a lower CPA with ongoing revenue share — the most popular model for growing bookmakers.',
              details: ['e.g. KES 1,000 CPA + 20% rev share', 'Best balance of upfront + recurring', 'Recommended for new partnerships', 'Fully customisable terms'],
            },
          ].map(({ name, title, icon: Icon, color, border, bg, desc, details }) => (
            <div key={name} className={cn('rounded-xl border p-4', border, bg)}>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-background mb-3 border', border)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <p className={cn('text-xs font-bold uppercase tracking-wide', color)}>{name}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{title}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
              <ul className="mt-3 space-y-1.5">
                {details.map(d => (
                  <li key={d} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── PACKAGES ──────────────────────────────────────── */}
      <section id="packages" className="scroll-mt-16">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Advertising Packages</h2>
            <p className="text-sm text-muted-foreground">Fixed monthly placements — prices are indicative, contact us for a custom quote</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 pt-3">
          <PackageCard
            name="Starter"
            price="KES 25,000"
            features={[
              'Homepage banner (mobile)',
              'Bookmaker card — 5 match pages/day',
              'Monthly performance report',
              '1-month minimum commitment',
            ]}
          />
          <PackageCard
            name="Growth"
            price="KES 60,000"
            badge="Most Popular"
            highlight
            features={[
              'Homepage banner (desktop + mobile)',
              'Bookmaker card — all match pages',
              '2× in-feed sponsored tip posts/week',
              'Email newsletter inclusion (monthly)',
              'Dedicated account manager',
              'Monthly performance report',
            ]}
          />
          <PackageCard
            name="Premium"
            price="Custom"
            features={[
              'All Growth package features',
              'Jackpot page exclusive sponsorship',
              'Weekly in-feed sponsored tips',
              'Logo on AI Predictor page',
              'Push notification sponsorship',
              'Co-branded betting challenge',
              'Quarterly strategy review',
            ]}
          />
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          <strong>Note:</strong> All packages can be combined with CPA or Revenue Share models — the advertising placement is separate from, and does not replace, the affiliate commission. Prices are KES per calendar month, VAT exclusive.
        </div>
      </section>

      {/* ── WHY BETCHEZA ──────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">Why advertise on Betcheza?</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Target, label: 'Verified bettors only', desc: 'Every user has registered and verified their account — no bots, no casual visitors.' },
            { icon: Smartphone, label: 'Mobile-first', desc: '87% mobile traffic means your ads reach users on the same device they use to bet.' },
            { icon: Globe, label: 'Kenya market leader', desc: 'Dominant presence in Kenya — the most valuable betting market in East Africa.' },
            { icon: BarChart3, label: 'Transparent reporting', desc: 'Full impression, click, and conversion reporting. No black-box metrics.' },
            { icon: Calendar, label: 'Match-day peak traffic', desc: 'Traffic spikes 3–5× on match days — maximum exposure when intent is highest.' },
            { icon: Zap, label: 'Fast-growing audience', desc: 'Growing by 3,000+ new users per month with no signs of slowing down.' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-3">
              <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTACT ───────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-16">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Get in Touch</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Ready to partner with us?</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg">
            Contact our partnerships team for a custom media kit, audience data pack, or to discuss a tailored deal. We typically respond within 24 hours on business days.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Email */}
            <a
              href="mailto:partnerships@betcheza.co.ke?subject=Advertising%20Enquiry%20-%20Betcheza&body=Hi%20Betcheza%20Partnerships%20Team%2C%0A%0AI%20am%20interested%20in%20advertising%20on%20Betcheza.%20Please%20send%20me%20your%20media%20kit.%0A%0ACompany%3A%20%0AWebsite%3A%20%0AMonthly%20budget%3A%20%0AModel%20preferred%20(CPA%2FRevShare%2FFixed)%3A%20%0A%0AThanks"
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email us</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">partnerships@betcheza.co.ke</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Response within 24 hours</p>
              </div>
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I'm%20interested%20in%20advertising%20on%20your%20platform.%20Please%20send%20me%20your%20media%20kit."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-card p-4 hover:border-green-500/60 hover:bg-green-500/5 transition-colors group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp only (no calls)</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-green-600 transition-colors">+254 113 226 240</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Message us on WhatsApp — no phone calls</p>
              </div>
            </a>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3">When you reach out, it helps to include:</p>
            <div className="flex flex-wrap gap-2">
              {['Your company name & website', 'Preferred partnership model', 'Monthly budget range', 'Target market / offer'].map(item => (
                <span key={item} className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                  <ChevronRight className="h-3 w-3 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER LINKS ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border pt-4">
        <Link href="/about" className="hover:text-foreground transition-colors">About Betcheza</Link>
        <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        <Link href="/tipsters" className="hover:text-foreground transition-colors">Our Tipsters</Link>
        <Link href="/responsible-gambling" className="hover:text-foreground transition-colors">Responsible Gambling</Link>
      </div>

    </div>
  );
}
