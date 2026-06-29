'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, Trophy, Target, Globe,
  Smartphone, Mail, MessageCircle, CheckCircle2, Zap,
  Star, Shield, ArrowRight, DollarSign, Eye, MousePointer,
  Radio, Calendar, Award, MapPin, Clock, Megaphone,
  ChevronRight, Handshake, LayoutDashboard, PieChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdvertiseStats {
  totalTips: number | null;
  overallWinRate: number | null;
  monthlyPageviews: number | null;
  avgSessionMinutes: number | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function StatCard({
  icon: Icon, value, label, sub,
  color = 'text-primary', bg = 'bg-primary/10', border = 'border-primary/20',
}: {
  icon: typeof Eye;
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
      highlight ? 'border-primary bg-primary/5 relative' : 'border-border bg-card'
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
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

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
    <div className="w-full px-3 py-4 sm:px-5 sm:py-6 space-y-8 max-w-5xl mx-auto">

      {/* ── HERO ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Advertise on Betcheza</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">
          Kenya's sports betting tips platform — <span className="text-primary">reach bettors who are ready to bet</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Betcheza is Kenya's leading sports predictions community. Place your brand in front of a highly engaged, mobile-first audience actively searching for bookmakers, odds, and betting insights.
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

      {/* ── LIVE STATISTICS ──────────────────────────────── */}
      <section id="stats" className="scroll-mt-16">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-green-600">Live Platform Statistics</span>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-0.5">Real numbers, no inflated claims</h2>
        <p className="text-xs text-muted-foreground mb-4">Figures pulled directly from our platform database in real time.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(c => (
            <StatCard key={c.label} icon={c.icon} value={c.value} label={c.label} sub={c.sub} color={c.color} bg={c.bg} border={c.border} />
          ))}
        </div>
      </section>

      {/* ── AUDIENCE DEMOGRAPHICS ────────────────────────── */}
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-foreground">Geography</span>
            </div>
            <div className="space-y-2.5">
              <DemographicBar label="Kenya" percent={78} color="bg-green-500" />
              <DemographicBar label="East Africa" percent={93} color="bg-emerald-400" />
              <DemographicBar label="Uganda" percent={6} color="bg-blue-400" />
              <DemographicBar label="Tanzania" percent={5} color="bg-cyan-400" />
              <DemographicBar label="Other" percent={7} color="bg-muted-foreground/40" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-foreground">Age Breakdown</span>
            </div>
            <div className="space-y-2.5">
              {([['18–24', 31, 'bg-violet-400'], ['25–34', 44, 'bg-purple-500'], ['35–44', 18, 'bg-indigo-400'], ['45+', 7, 'bg-slate-400']] as const).map(([range, pct, clr]) => (
                <DemographicBar key={range} label={`Age ${range}`} percent={pct} color={clr} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-foreground">Device Split</span>
            </div>
            <div className="space-y-2.5">
              <DemographicBar label="Mobile" percent={87} color="bg-orange-500" />
              <DemographicBar label="Desktop / Tablet" percent={13} color="bg-orange-300" />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              87% mobile — your ads are seen on the go, on the same device users bet from.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-foreground">Sports Interest</span>
            </div>
            <div className="space-y-2.5">
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

        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {[
            { icon: Target, label: 'High Purchase Intent', desc: 'Users are actively comparing bookmakers and odds — not casual browsers.', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
            { icon: DollarSign, label: 'Active Bettors', desc: 'Our users actively fund betting accounts — they have money to spend on your platform.', color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/20' },
            { icon: Globe, label: 'Kenyan Market Focus', desc: 'Betcheza reaches Kenya\'s most engaged bettors — the largest sports betting market in East Africa.', color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
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

      {/* ── AD PLACEMENTS ────────────────────────────────── */}
      <section id="placements" className="scroll-mt-16">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <LayoutDashboard className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Ad Placements Available</h2>
            <p className="text-sm text-muted-foreground">High-visibility positions across the platform</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              title: 'Homepage Banner',
              icon: Eye,
              color: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5',
              desc: 'Top-of-page banner — the first thing every visitor sees on Betcheza.',
              specs: ['Desktop: 1200×120px leaderboard', 'Mobile: 375×80px banner', 'Link-through to your site or offer'],
            },
            {
              title: 'Match Pages — Bookmaker Card',
              icon: Trophy,
              color: 'text-green-600', border: 'border-green-500/20', bg: 'bg-green-500/5',
              desc: 'Featured on every match page alongside odds — shown when users are deciding where to bet.',
              specs: ['Highest-intent placement on the platform', 'Logo + offer text + CTA button', 'Contextually next to odds comparison'],
            },
            {
              title: 'In-Feed Sponsored Tips',
              icon: TrendingUp,
              color: 'text-purple-500', border: 'border-purple-500/20', bg: 'bg-purple-500/5',
              desc: 'Native sponsored tip cards in the Community Feed and Tipsters pages.',
              specs: ['Native card format — blends with content', 'Your logo + tip text + CTA', 'Sponsored label for compliance'],
            },
            {
              title: 'Jackpot Page Sponsorship',
              icon: Star,
              color: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5',
              desc: 'Exclusive sponsor of the Jackpots page — prime real estate for jackpot betting traffic.',
              specs: ['Full-width banner at top of page', 'Your jackpot listed prominently', 'Only 1 sponsor slot available'],
            },
            {
              title: 'Email Newsletter Inclusion',
              icon: Mail,
              color: 'text-rose-500', border: 'border-rose-500/20', bg: 'bg-rose-500/5',
              desc: 'Your offer in our weekly tips newsletter sent to all subscribed users every Monday.',
              specs: ['Logo + headline + offer link', 'Sent before weekend fixtures', 'Opted-in subscribers only'],
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
              <div className="flex flex-wrap gap-1.5 mt-3">
                {specs.map(sp => (
                  <span key={sp} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {sp}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PARTNERSHIP MODELS ───────────────────────────── */}
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
              name: 'CPA', title: 'Cost Per Acquisition', icon: MousePointer,
              color: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5',
              desc: 'Pay only when we send you a depositing player. Zero risk — you pay for results.',
              details: ['KES 1,500–5,000 per FTD', 'Tracked via unique affiliate links', 'Monthly payout reconciliation'],
            },
            {
              name: 'Revenue Share', title: 'Revenue Share', icon: TrendingUp,
              color: 'text-emerald-600', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5',
              desc: 'Share a percentage of net gaming revenue from players we refer. Long-term model.',
              details: ['Minimum 30% NGR share', 'Lifetime player attribution', 'No negative carryover'],
            },
            {
              name: 'Hybrid', title: 'Hybrid Deal', icon: Award,
              color: 'text-amber-600', border: 'border-amber-500/20', bg: 'bg-amber-500/5',
              desc: 'Lower CPA combined with ongoing revenue share — most popular for growing bookmakers.',
              details: ['e.g. KES 1,000 CPA + 20% rev share', 'Best balance of upfront + recurring', 'Fully customisable terms'],
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

      {/* ── PACKAGES ─────────────────────────────────────── */}
      <section id="packages" className="scroll-mt-16">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Advertising Packages</h2>
            <p className="text-sm text-muted-foreground">Fixed monthly placements — contact us for a custom quote</p>
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
              '2× in-feed sponsored tips/week',
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

        <p className="mt-4 text-xs text-muted-foreground rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 leading-relaxed">
          <strong className="text-amber-700 dark:text-amber-400">Note:</strong> All packages can be combined with CPA or Revenue Share models. Prices are KES per calendar month, VAT exclusive.
        </p>
      </section>

      {/* ── WHY BETCHEZA ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">Why advertise on Betcheza?</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: Target, label: 'Verified bettors only', desc: 'Every user has registered and verified their account — no bots, no casual visitors.' },
            { icon: Smartphone, label: 'Mobile-first', desc: '87% mobile traffic — ads are seen on the same device users use to bet.' },
            { icon: Globe, label: 'Kenya market focus', desc: 'Strong presence in Kenya, the most valuable sports betting market in East Africa.' },
            { icon: BarChart3, label: 'Transparent reporting', desc: 'Full impression, click, and conversion reporting. No black-box metrics.' },
            { icon: Calendar, label: 'Match-day peak traffic', desc: 'Traffic spikes 3–5× on match days — maximum exposure when betting intent is highest.' },
            { icon: Zap, label: 'Growing platform', desc: 'Consistent growth with an engaged community of tipsters and bettors.' },
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

      {/* ── CONTACT ──────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-16">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Get in Touch</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Ready to partner with us?</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-lg">
            Contact our partnerships team for a media kit, audience data pack, or to discuss a tailored deal. We respond within 24 hours on business days.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
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

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-2">When you reach out, please include:</p>
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

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border pt-4">
        <Link href="/about" className="hover:text-foreground transition-colors">About Betcheza</Link>
        <Link href="/tipsters" className="hover:text-foreground transition-colors">Our Tipsters</Link>
        <Link href="/responsible-gambling" className="hover:text-foreground transition-colors">Responsible Gambling</Link>
      </div>

    </div>
  );
}
