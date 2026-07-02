'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Handshake, BarChart3, Target, Eye, Star, DollarSign, Shield,
  CheckCircle2, ChevronRight, MapPin, Globe, Smartphone, Radio,
  Mail, MessageCircle, Clock, TrendingUp, Users, Zap, FileText,
  PieChart, BadgeCheck, ArrowUpRight, Send, Loader2, LayoutDashboard,
  Megaphone, Activity, Lock, RefreshCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────── */
interface PlatformStats {
  totalTips:        number | null;
  overallWinRate:   number | null;
  monthlyPageviews: number | null;
  avgSessionMinutes:number | null;
  totalUsers:       number | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return Math.round(n / 1_000) + 'K';
  return n.toLocaleString();
}

function fmtStat(
  loading: boolean,
  val: number | null,
  suffix = '',
  fallback = '—',
): string {
  if (loading) return '…';
  if (val == null || val === 0) return fallback;
  return fmt(val) + suffix;
}

function DemographicBar({
  label, percent, color,
}: { label: string; percent: number; color: string }) {
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

/* ── LEFT SIDEBAR ───────────────────────────────────────────── */
function PartnerLeftSidebar() {
  return (
    <div className="space-y-3">

      {/* Partnership Models */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-emerald-500" />
          Partnership Models
        </p>
        <div className="space-y-2.5">
          {[
            {
              tag: 'CPA',
              title: 'Cost Per Acquisition',
              desc: 'Fixed fee per first-deposit player. One-time payment per qualified referral. Rate negotiated per partner.',
              color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            },
            {
              tag: 'Rev Share',
              title: 'Revenue Share',
              desc: 'Percentage of Net Gaming Revenue. Lifetime player attribution — earn as long as they play.',
              color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            },
            {
              tag: 'Hybrid',
              title: 'Hybrid Deal',
              desc: 'Reduced CPA + ongoing rev share. Best of both worlds for high-volume partners.',
              color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
            },
          ].map(({ tag, title, desc, color }) => (
            <div key={tag} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold', color)}>{tag}</span>
                <span className="text-xs font-semibold text-foreground">{title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Audience — Clarity Analytics */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <PieChart className="h-3.5 w-3.5 text-blue-500" />
          Audience (Clarity Analytics)
        </p>

        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="h-3 w-3 text-green-500" />
            <span className="text-[11px] font-semibold text-foreground">Geography</span>
          </div>
          <div className="space-y-1.5">
            <DemographicBar label="Kenya"       percent={78} color="bg-green-500"  />
            <DemographicBar label="East Africa" percent={93} color="bg-emerald-400"/>
            <DemographicBar label="Uganda"      percent={6}  color="bg-blue-400"   />
            <DemographicBar label="Tanzania"    percent={5}  color="bg-cyan-400"   />
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="h-3 w-3 text-purple-500" />
            <span className="text-[11px] font-semibold text-foreground">Age Breakdown</span>
          </div>
          <div className="space-y-1.5">
            {([ ['18–24', 31, 'bg-violet-400'], ['25–34', 44, 'bg-purple-500'], ['35–44', 18, 'bg-indigo-400'], ['45+', 7, 'bg-slate-400'] ] as const).map(([range, pct, clr]) => (
              <DemographicBar key={range} label={`Age ${range}`} percent={pct} color={clr} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Smartphone className="h-3 w-3 text-orange-500" />
            <span className="text-[11px] font-semibold text-foreground">Device Split</span>
          </div>
          <div className="space-y-1.5">
            <DemographicBar label="Mobile"          percent={87} color="bg-orange-500" />
            <DemographicBar label="Desktop / Tablet" percent={13} color="bg-orange-300" />
          </div>
        </div>

        <p className="mt-2.5 text-[10px] text-muted-foreground leading-relaxed italic">
          Source: Microsoft Clarity — rolling 30-day average
        </p>
      </div>

      {/* Reporting */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
          Reporting &amp; Tracking
        </p>
        <ul className="space-y-1.5">
          {[
            'Real-time click & conversion dashboard',
            'Player lifetime value tracking',
            'Per-placement attribution (banner, match, odds)',
            'Weekly automated reports via email',
            'UTM & custom pixel support',
            'Postback URL integration',
          ].map(item => (
            <li key={item} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

/* ── RIGHT SIDEBAR ──────────────────────────────────────────── */
function PartnerRightSidebar({
  stats, loading,
}: { stats: PlatformStats | null; loading: boolean }) {
  const s = stats;
  return (
    <div className="space-y-3">

      {/* Advertising Packages */}
      <div className="rounded-xl border border-primary/20 bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Advertising Packages
          </span>
        </div>
        <div className="space-y-2">
          {[
            {
              tag: 'Starter',
              title: 'Banner Ads',
              price: 'KES 25K/mo',
              desc: '728×90 + 300×250 on all match & league pages',
              color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
              dot: 'bg-blue-500',
            },
            {
              tag: 'Popular',
              title: 'Odds Integration',
              price: 'KES 40K/mo',
              desc: 'Live odds on every match page with deeplinks',
              color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
              dot: 'bg-emerald-500',
            },
            {
              tag: 'Premium',
              title: 'Homepage Feature',
              price: 'KES 35K/mo',
              desc: 'Above-the-fold featured slot with promo banner',
              color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
              dot: 'bg-amber-500',
            },
            {
              tag: 'Best Value',
              title: 'Full Package',
              price: 'KES 80K/mo',
              desc: 'Banners + odds + homepage + email campaigns',
              color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
              dot: 'bg-violet-500',
            },
          ].map(({ tag, title, price, desc, color, dot }) => (
            <div key={tag} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
              <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dot)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-semibold text-foreground truncate">{title}</span>
                  <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold', color)}>{tag}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                <p className="text-[11px] font-bold text-primary mt-1">{price}</p>
              </div>
            </div>
          ))}
        </div>
        <a
          href="#contact"
          className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary/10 border border-primary/20 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <ArrowUpRight className="h-3 w-3" />
          Enquire about a package
        </a>
      </div>

      {/* Why partner */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          Why Partner Here
        </p>
        <ul className="space-y-1.5">
          {[
            "Kenya's leading sports tips community",
            '87% mobile-first audience (Clarity)',
            'Match-day traffic spikes 3–5×',
            'Transparent reporting & attribution',
            'Dedicated partnership manager',
            'Fast approval — start in 48 hrs',
          ].map(item => (
            <li key={item} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 to-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Handshake className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Start a Partnership</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          Get our media kit and a custom proposal within 24 hours. No commitment required.
        </p>
        <a
          href="mailto:partnerships@betcheza.co.ke?subject=Partnership%20Enquiry%20-%20Betcheza&body=Hi%20Betcheza%20Partnerships%20Team%2C%0A%0AI%20am%20interested%20in%20a%20partnership%20with%20Betcheza.%0A%0ACompany%3A%20%0AWebsite%3A%20%0AModel%20preferred%20(CPA%2FRevShare%2FHybrid)%3A%20%0AExpected%20monthly%20volume%3A%20%0A%0AThanks"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors mb-2"
        >
          <Mail className="h-3.5 w-3.5" />
          Email partnerships team
        </a>
        <a
          href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I%27m%20interested%20in%20a%20partnership.%20Please%20send%20me%20your%20media%20kit."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-green-500/40 bg-green-500/10 py-2 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp (no calls)
        </a>
      </div>

    </div>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════ */
interface InquiryForm {
  company: string; name: string; email: string; phone: string;
  website: string; model: string; volume: string; message: string;
}
const EMPTY_FORM: InquiryForm = {
  company: '', name: '', email: '', phone: '',
  website: '', model: '', volume: '', message: '',
};

export default function PartnerPage() {
  const [stats, setStats]         = useState<PlatformStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const pathname                  = usePathname();

  const [form, setForm]           = useState<InquiryForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function setField(k: keyof InquiryForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setSubmitResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company || !form.name || !form.email) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res  = await fetch('/api/advertise/enquiry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, budget: form.volume, source: 'partner-page' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitResult({ ok: true, msg: "We got your enquiry! We'll be in touch within 24 hours with a custom proposal." });
        setForm(EMPTY_FORM);
      } else if (data.skipped) {
        setSubmitResult({ ok: false, msg: 'Email not configured yet — please email partnerships@betcheza.co.ke directly.' });
      } else {
        setSubmitResult({ ok: false, msg: data.error || 'Something went wrong. Please try again.' });
      }
    } catch {
      setSubmitResult({ ok: false, msg: 'Network error. Please try again or email us directly.' });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    fetch('/api/advertise/stats')
      .then(r  => r.json())
      .then(d  => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch('/api/track/pageview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  /* derived display values */
  const dTips     = fmtStat(loading, stats?.totalTips        ?? null);
  const dWinRate  = fmtStat(loading, stats?.overallWinRate   ?? null, '%');
  const dSession  = fmtStat(loading, stats?.avgSessionMinutes ?? null, ' min');

  return (
    <div className="flex min-h-screen w-full">

      {/* ── LEFT SIDEBAR (lg+) ───────────────────────────────── */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border">
        <div className="sticky top-14 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <PartnerLeftSidebar />
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="px-3 py-3 sm:px-4 sm:py-4 space-y-4 w-full">

          {/* HERO */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Handshake className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Partner with Betcheza</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 leading-tight">
              Grow your bookmaker brand with{' '}
              <span className="text-primary">Kenya&apos;s most engaged bettors</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Betcheza is Kenya&apos;s leading sports predictions platform — 87% mobile-first audience,
              93% East Africa reach, and 2.5-minute average sessions verified by Microsoft Clarity.
              Our partnership programme is built around transparency, real attribution, and deals
              that grow with your business.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { label: 'Who We Are',         href: '#about'    },
                { label: 'Partnership Models', href: '#models'   },
                { label: 'Reporting',          href: '#reporting'},
                { label: 'Get Started',        href: '#contact'  },
              ].map(l => (
                <a
                  key={l.href} href={l.href}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/advertise"
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <ArrowUpRight className="h-3 w-3" />
                Ad Placements
              </Link>
            </div>
          </div>

          {/* WHO IS BETCHEZA */}
          <div id="about" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Who is Betcheza?
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              {[
                {
                  icon: Eye,        color: 'text-purple-500', bg: 'bg-purple-500/10',
                  val: '50K+',      label: 'Monthly Visitors',   sub: 'Rolling 30 days · Clarity',
                },
                {
                  icon: Globe,      color: 'text-blue-500',   bg: 'bg-blue-500/10',
                  val: '93%',       label: 'East Africa Reach',  sub: 'Kenya · Uganda · Tanzania',
                },
                {
                  icon: Target,     color: 'text-pink-500',   bg: 'bg-pink-500/10',
                  val: dTips,       label: 'Tips on platform',   sub: 'AI + community picks',
                },
                {
                  icon: Smartphone, color: 'text-orange-500', bg: 'bg-orange-500/10',
                  val: '87%',       label: 'Mobile traffic',     sub: 'Source: Clarity',
                },
              ].map(({ icon: Icon, color, bg, val, label, sub }) => (
                <div key={label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground leading-none">{val}</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Betcheza is Kenya&apos;s leading sports betting tips and predictions platform. Our users are active
              bettors — not casual browsers. They visit match pages, compare odds, read expert tips, and use our
              picks to inform their bets every single day. As a partner, your brand sits exactly where the decision
              happens.
            </p>
          </div>

          {/* WHY YOUR AUDIENCE IS VALUABLE */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Why is Our Audience Valuable to You?
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                {
                  icon: Radio,
                  color: 'text-red-500',
                  title: 'Match-day intent spikes',
                  desc: 'Traffic rises sharply during big match days. Users are in betting mode when they see your brand.',
                },
                {
                  icon: Zap,
                  color: 'text-amber-500',
                  title: 'High conversion intent',
                  desc: 'Users arrive looking for odds, picks, and where to bet. Purchase intent is already there.',
                },
                {
                  icon: BadgeCheck,
                  color: 'text-green-500',
                  title: 'Verified real bettors',
                  desc: 'Every user has registered. No incentive traffic, no bot farms.',
                },
                {
                  icon: Globe,
                  color: 'text-blue-500',
                  title: 'Kenya-focused audience',
                  desc: '78% Kenya, 93% East Africa per Clarity. Your brand reaches the exact market you are targeting.',
                },
                {
                  icon: Clock,
                  color: 'text-purple-500',
                  title: `${dSession} average session`,
                  desc: 'Bettors spend time comparing tips, reading analysis, and checking odds before they bet.',
                },
                {
                  icon: TrendingUp,
                  color: 'text-emerald-500',
                  title: 'Growing platform',
                  desc: 'Month-on-month user and pageview growth as sports betting in Kenya continues to expand.',
                },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex items-start gap-2.5 rounded-lg border border-border/50 p-2.5">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', color)} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PARTNERSHIP MODELS */}
          <div id="models" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              How Partnership Models Work
            </h2>
            <div className="space-y-3">
              {[
                {
                  tag: 'CPA',
                  color: 'border-blue-500/30 bg-blue-500/5',
                  tagColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                  title: 'Cost Per Acquisition',
                  rate: 'Fixed fee per qualified first-deposit player — rate agreed per partner',
                  bullets: [
                    'One-time payment per first-deposit referral',
                    'Minimum deposit threshold agreed upfront',
                    'Weekly payout on verified conversions',
                    'No ongoing commitment — scale up or down',
                    'Best for: bookmakers with strong player retention',
                  ],
                },
                {
                  tag: 'Rev Share',
                  color: 'border-emerald-500/30 bg-emerald-500/5',
                  tagColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
                  title: 'Revenue Share',
                  rate: 'Percentage of Net Gaming Revenue — lifetime player attribution',
                  bullets: [
                    "Earn a percentage of every player's net revenue — forever",
                    'Lifetime player cookie — credited as long as they play',
                    'Monthly reporting of NGR per referred player',
                    'No negative carryover to next month',
                    'Best for: bookmakers with high LTV players',
                  ],
                },
                {
                  tag: 'Hybrid',
                  color: 'border-amber-500/30 bg-amber-500/5',
                  tagColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                  title: 'Hybrid Deal',
                  rate: 'Reduced CPA + ongoing revenue share',
                  bullets: [
                    'Get paid on acquisition AND on ongoing revenue',
                    'Lower CPA rate balances the rev share upside',
                    'Ideal for partners who want immediate and recurring income',
                    'Fully negotiable split based on volume',
                    'Best for: established affiliates with proven traffic',
                  ],
                },
              ].map(({ tag, color, tagColor, title, rate, bullets }) => (
                <div key={tag} className={cn('rounded-xl border p-3', color)}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', tagColor)}>{tag}</span>
                    <span className="text-xs font-bold text-foreground">{title}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-foreground mb-2">{rate}</p>
                  <ul className="space-y-1">
                    {bullets.map(b => (
                      <li key={b} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* REPORTING */}
          <div id="reporting" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Campaign Reporting &amp; Transparency
            </h2>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Every partner gets full visibility into their campaign performance. We believe transparency
              builds long-term partnerships — you should always know exactly what you&apos;re getting.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { icon: LayoutDashboard, color: 'text-primary',      title: 'Real-time dashboard',      desc: 'Click, conversion, and revenue data updated continuously.'           },
                { icon: FileText,        color: 'text-blue-500',     title: 'Weekly email reports',      desc: 'Automated PDF reports delivered every Monday morning.'               },
                { icon: Activity,        color: 'text-emerald-500',  title: 'Conversion funnel view',    desc: 'See clicks → sign-ups → deposits → revenue in one view.'            },
                { icon: MapPin,          color: 'text-orange-500',   title: 'Placement attribution',     desc: 'Know which ad slot, match, or page drove each conversion.'           },
                { icon: RefreshCcw,      color: 'text-purple-500',   title: 'Postback & pixel support',  desc: 'S2S postback URLs and conversion pixels for your tracking stack.'   },
                { icon: Lock,            color: 'text-slate-500',    title: 'Secure data access',        desc: 'Role-based reporting — only your data, fully isolated.'              },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', color)} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              How to Get Started
            </h2>
            <div className="space-y-2">
              {[
                { step: '1', title: 'Submit an enquiry',         desc: 'Fill out the form below or email us. Tell us about your bookmaker, target market, and preferred deal model.' },
                { step: '2', title: 'Receive a custom proposal', desc: 'Within 24 hours we send you our media kit, real audience data, and a tailored deal structure.' },
                { step: '3', title: 'Agree terms & go live',     desc: "Sign a simple partnership agreement. We set up your tracking links and you're live within 48 hours." },
                { step: '4', title: 'Get reporting from day 1',  desc: 'Real-time clicks and conversions in your dashboard. Weekly reports every Monday. Payments on agreed schedule.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {step}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WIN RATE CALLOUT — only if we have real data */}
          {!loading && stats?.overallWinRate != null && (
            <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-4 flex items-center gap-4">
              <Star className="h-8 w-8 shrink-0 text-green-500" />
              <div>
                <p className="text-lg font-bold text-foreground">{dWinRate} platform win rate</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculated from all settled tips — real results, nothing cherry-picked.
                </p>
              </div>
            </div>
          )}

          {/* CONTACT FORM */}
          <div id="contact" className="rounded-xl border border-primary/20 bg-card p-4">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Send a Partnership Enquiry
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              We respond within 24 hours with a custom proposal.
            </p>

            {submitResult && (
              <div className={cn(
                'mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs',
                submitResult.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
              )}>
                {submitResult.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                  : <Megaphone    className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                {submitResult.msg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  { k: 'company',  label: 'Company Name *',       ph: 'Your bookmaker name',  type: 'text',  req: true  },
                  { k: 'name',     label: 'Your Name *',          ph: 'First & last name',    type: 'text',  req: true  },
                  { k: 'email',    label: 'Email *',              ph: 'you@bookmaker.com',    type: 'email', req: true  },
                  { k: 'phone',    label: 'Phone / WhatsApp',     ph: '+254 7...',             type: 'text',  req: false },
                  { k: 'website',  label: 'Website',              ph: 'https://yoursite.com', type: 'url',   req: false },
                ] as const).map(({ k, label, ph, type, req }) => (
                  <div key={k} className="space-y-1">
                    <label className="text-[10px] font-medium uppercase text-muted-foreground">{label}</label>
                    <input
                      required={req}
                      type={type}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      placeholder={ph}
                      value={form[k]}
                      onChange={e => setField(k, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">Preferred Model</label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    value={form.model}
                    onChange={e => setField('model', e.target.value)}
                  >
                    <option value="">Select a model…</option>
                    <option value="CPA">CPA (Cost Per Acquisition)</option>
                    <option value="Revenue Share">Revenue Share</option>
                    <option value="Hybrid">Hybrid (CPA + Rev Share)</option>
                    <option value="Fixed Banner">Fixed Banner / Sponsorship</option>
                    <option value="Not sure">Not sure — open to discussion</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground">Expected Monthly Volume</label>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  value={form.volume}
                  onChange={e => setField('volume', e.target.value)}
                >
                  <option value="">Select expected volume…</option>
                  <option value="&lt;100">Under 100 referrals/month</option>
                  <option value="100-500">100–500 referrals/month</option>
                  <option value="500-2000">500–2,000 referrals/month</option>
                  <option value="2000+">2,000+ referrals/month</option>
                  <option value="unknown">Not sure yet</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground">Tell us more (optional)</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                  placeholder="Tell us about your bookmaker, target market, current affiliate partners, or any questions you have…"
                  value={form.message}
                  onChange={e => setField('message', e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !form.company || !form.name || !form.email}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                  : <><Send    className="h-3.5 w-3.5" /> Send Partnership Enquiry</>}
              </button>
              <p className="text-center text-[10px] text-muted-foreground">
                Or email us directly at{' '}
                <a href="mailto:partnerships@betcheza.co.ke" className="text-primary underline underline-offset-2">
                  partnerships@betcheza.co.ke
                </a>
              </p>
            </form>
          </div>

        </div>
      </div>

      {/* ── RIGHT SIDEBAR (xl+) ──────────────────────────────── */}
      <aside className="hidden xl:block w-64 shrink-0 border-l border-border">
        <div className="sticky top-14 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <PartnerRightSidebar stats={stats} loading={loading} />
        </div>
      </aside>

    </div>
  );
}
