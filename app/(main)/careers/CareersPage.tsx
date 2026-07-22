'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, Users, TrendingUp, Megaphone, Smartphone,
  MessageCircle, Mail, CheckCircle2, ChevronRight,
  Star, DollarSign, Zap, Globe, Shield, Award,
  ArrowUpRight, Loader2, BadgeCheck, Flame,
  UserPlus, BarChart3, Radio, BookOpen, Share2,
  Handshake, Target, Wallet, Clock, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Role data ──────────────────────────────────────────────── */
const ROLES = [
  {
    id: 'sales-agent',
    title: 'Sales Agent',
    badge: 'Most Openings',
    badgeColor: 'bg-primary text-primary-foreground',
    icon: Users,
    color: 'text-primary',
    border: 'border-primary/25',
    bg: 'bg-primary/5',
    tagline: 'Recruit users, earn per signup',
    earn: 'KES 200–500 per verified user',
    earnDetail: 'Earn every time someone you refer registers and places their first tip or bet.',
    remote: true,
    skills: ['Strong network (WhatsApp, Facebook, church, sacco, workplace)', 'Good communicator', 'Smartphone with internet'],
    duties: [
      'Share Betcheza referral links in your circles',
      'Demo the platform to potential users',
      'Follow up on sign-ups via WhatsApp',
      'Monthly targets (optional — higher targets = higher bonus)',
    ],
    highlight: true,
  },
  {
    id: 'campus-rep',
    title: 'Campus Representative',
    badge: 'Students Welcome',
    badgeColor: 'bg-violet-500 text-white',
    icon: BookOpen,
    color: 'text-violet-500',
    border: 'border-violet-500/25',
    bg: 'bg-violet-500/5',
    tagline: 'Own your campus — earn big',
    earn: 'KES 300 per active user + monthly bonus',
    earnDetail: 'Higher rate for campus reps. Plus monthly bonus if your campus reaches 50+ active users.',
    remote: true,
    skills: ['University or college student', 'Social and outgoing', 'Interest in football/sports'],
    duties: [
      'Be the Betcheza face on your campus',
      'Host watch-party events and tip discussions',
      'Recruit classmates and hostel-mates',
      'Run polls and predictions challenges',
    ],
    highlight: false,
  },
  {
    id: 'social-media-creator',
    title: 'Social Media Creator',
    badge: 'Content Creators',
    badgeColor: 'bg-rose-500 text-white',
    icon: Share2,
    color: 'text-rose-500',
    border: 'border-rose-500/25',
    bg: 'bg-rose-500/5',
    tagline: 'Create content, earn from traffic',
    earn: 'KES 150 per sign-up from your content',
    earnDetail: 'Post predictions, match threads, betting tips content on Instagram, TikTok, X or YouTube with your referral link.',
    remote: true,
    skills: ['Active TikTok / Instagram / X / YouTube account', 'Sports knowledge', 'Basic video or graphic skills'],
    duties: [
      'Create football/sports prediction content',
      'Embed your referral link in bio and posts',
      'Post at least 3× per week',
      'Track conversions via your dashboard',
    ],
    highlight: false,
  },
  {
    id: 'whatsapp-manager',
    title: 'WhatsApp Group Manager',
    badge: 'High Demand',
    badgeColor: 'bg-green-600 text-white',
    icon: MessageCircle,
    color: 'text-green-600',
    border: 'border-green-500/25',
    bg: 'bg-green-500/5',
    tagline: 'Manage a tips group, earn per conversion',
    earn: 'KES 200 per active user referred',
    earnDetail: 'Run a dedicated Betcheza tips WhatsApp group. Every member who signs up via your link earns you commission.',
    remote: true,
    skills: ['Own or admin an active WhatsApp group (100+ members preferred)', 'Consistent and reliable', 'Sports / football interest'],
    duties: [
      'Share daily strategy picks from Betcheza',
      'Grow group membership organically',
      'Convert members to Betcheza accounts',
      'Maintain group rules and quality',
    ],
    highlight: false,
  },
  {
    id: 'affiliate-marketer',
    title: 'Affiliate / Online Marketer',
    badge: 'Digital Natives',
    badgeColor: 'bg-amber-500 text-white',
    icon: Globe,
    color: 'text-amber-600',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/5',
    tagline: 'Drive traffic, earn on every conversion',
    earn: 'KES 150–400 per signup + rev share option',
    earnDetail: 'Bloggers, SEO specialists, and paid-ads experts. Build traffic funnels to Betcheza and earn on every sign-up plus optional rev share.',
    remote: true,
    skills: ['Blog, website, or paid ads experience', 'SEO or Google Ads knowledge a plus', 'Ability to scale traffic independently'],
    duties: [
      'Create landing pages or blog content for Betcheza',
      'Run Google/Facebook ads pointing to your referral link',
      'Optimise conversion funnels',
      'Report monthly traffic and conversion data',
    ],
    highlight: false,
  },
  {
    id: 'tipster-partner',
    title: 'Verified Tipster Partner',
    badge: 'Football Experts',
    badgeColor: 'bg-cyan-500 text-white',
    icon: TrendingUp,
    color: 'text-cyan-600',
    border: 'border-cyan-500/25',
    bg: 'bg-cyan-500/5',
    tagline: 'Share tips, earn from your subscriber base',
    earn: 'Earn % of subscriber fees you generate',
    earnDetail: 'Get Verified Tipster status, build a following, and earn a share of premium subscription revenue attributed to your tips.',
    remote: true,
    skills: ['Strong football knowledge', 'Consistent track record of winning tips', 'Able to post at least 2 tips per day'],
    duties: [
      'Post quality football / sports predictions daily',
      'Build your tipster following on Betcheza',
      'Participate in monthly Tipster Challenges',
      'Maintain a win rate that grows subscriber trust',
    ],
    highlight: false,
  },
];

/* ── Commission structure ────────────────────────────────────── */
const COMMISSION_TIERS = [
  { tier: 'Starter', users: '1–20 users/month', rate: 'KES 200/user', total: 'Up to KES 4,000', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  { tier: 'Active', users: '21–50 users/month', rate: 'KES 300/user', total: 'Up to KES 15,000', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { tier: 'Pro', users: '51–100 users/month', rate: 'KES 400/user', total: 'Up to KES 40,000', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  { tier: 'Elite', users: '100+ users/month', rate: 'KES 500/user', total: 'KES 50,000+', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
];

/* ── Application form ────────────────────────────────────────── */
interface FormState {
  name: string;
  phone: string;
  email: string;
  role: string;
  location: string;
  network: string;
  message: string;
}
const EMPTY: FormState = { name: '', phone: '', email: '', role: '', location: '', network: '', message: '' };

/* ── Sub-components ─────────────────────────────────────────── */
function PerksBar({ icon: Icon, label, color }: { icon: typeof Star; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
      <span>{label}</span>
    </div>
  );
}

/* ── LEFT SIDEBAR ───────────────────────────────────────────── */
function CareersLeftSidebar() {
  return (
    <div className="space-y-3">

      {/* Why join */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          Why join Betcheza
        </p>
        <ul className="space-y-1.5">
          {[
            { icon: Wallet, label: 'Commission paid weekly via M-Pesa', color: 'text-green-500' },
            { icon: Clock, label: 'Work whenever you want — fully flexible', color: 'text-blue-500' },
            { icon: Smartphone, label: 'All you need is a phone', color: 'text-violet-500' },
            { icon: TrendingUp, label: 'Higher tiers = higher rate per user', color: 'text-primary' },
            { icon: Globe, label: 'Nationwide — Kenya & East Africa', color: 'text-amber-500' },
            { icon: Award, label: 'Monthly top agent bonus prizes', color: 'text-rose-500' },
            { icon: BarChart3, label: 'Live dashboard to track your earnings', color: 'text-cyan-500' },
          ].map(p => <PerksBar key={p.label} icon={p.icon} label={p.label} color={p.color} />)}
        </ul>
      </div>

      {/* Commission tiers */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          Commission Tiers (Sales Agent)
        </p>
        <div className="space-y-2">
          {COMMISSION_TIERS.map(t => (
            <div key={t.tier} className={cn('rounded-lg border px-2.5 py-2', t.color)}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-bold">{t.tier}</span>
                <span className="text-[10px] font-bold tabular-nums">{t.rate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] opacity-80">{t.users}</span>
                <span className="text-[10px] font-semibold">{t.total}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Tiers reset monthly. Payments weekly via M-Pesa.</p>
      </div>

      {/* Requirements */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-blue-500" />
          Basic Requirements
        </p>
        <ul className="space-y-1.5">
          {[
            'Kenyan resident (18+ years)',
            'Smartphone with internet access',
            'M-Pesa registered number',
            'Passion for sports / football',
            'No formal qualifications needed',
          ].map(r => (
            <li key={r} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Urgency */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
        <div className="flex items-start gap-2">
          <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">Currently onboarding</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We're actively growing our agent network across Kenya. Apply now — first 50 agents get a KES 500 sign-on bonus after their first 5 conversions.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── RIGHT SIDEBAR ──────────────────────────────────────────── */
function CareersRightSidebar() {
  return (
    <div className="space-y-3">

      {/* Earnings calculator preview */}
      <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-green-600">Example Earnings</span>
        </div>
        <div className="space-y-2.5">
          {[
            { scenario: '5 friends sign up', earn: 'KES 1,000' },
            { scenario: '20 referrals in a month', earn: 'KES 4,000–6,000' },
            { scenario: '50 active referrals', earn: 'KES 15,000–20,000' },
            { scenario: '100+ referrals (Elite)', earn: 'KES 50,000+' },
          ].map(({ scenario, earn }) => (
            <div key={scenario} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{scenario}</span>
              <span className="text-sm font-bold text-foreground tabular-nums">{earn}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed">
          Estimates for Sales Agent role. Other roles have different structures.
        </p>
      </div>

      {/* How payment works */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          How Payment Works
        </p>
        <div className="space-y-2">
          {[
            { step: '1', label: 'You share your unique referral link' },
            { step: '2', label: 'Friend signs up and verifies account' },
            { step: '3', label: 'Commission credited to your agent wallet' },
            { step: '4', label: 'Withdraw weekly via M-Pesa (min KES 500)' },
          ].map(({ step, label }) => (
            <div key={step} className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {step}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Open roles quick list */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          Open Positions
        </p>
        <div className="space-y-1.5">
          {ROLES.map(r => (
            <a
              key={r.id}
              href={`#${r.id}`}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <r.icon className={cn('h-3 w-3 shrink-0', r.color)} />
                <span className="truncate text-foreground font-medium">{r.title}</span>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold', r.badgeColor)}>
                {r.badge}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Quick apply CTA */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 to-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Ready to apply?</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          Fill in the application below and our team will WhatsApp you within 24 hours.
        </p>
        <a
          href="#apply"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors mb-2"
        >
          Apply Now — It's Free
        </a>
        <a
          href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I%27m%20interested%20in%20becoming%20a%20sales%20agent."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-green-500/40 bg-green-500/10 py-2 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp us to ask questions
        </a>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                      */
/* ══════════════════════════════════════════════════════════════ */
export default function CareersPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.role) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setResult({ ok: true, msg: "Application received! We'll WhatsApp you within 24 hours." });
        setForm(EMPTY);
      } else {
        // Fallback to WhatsApp if API not set up
        setResult({ ok: false, msg: "Couldn't submit online. Please WhatsApp us at 0113 226 240 to apply, or email careers@betcheza.co.ke." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error. WhatsApp us at 0113 226 240 to apply directly." });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors";
  const labelCls = "block text-[11px] font-semibold text-foreground mb-1";

  return (
    <div className="flex min-h-screen w-full">

      {/* ── LEFT SIDEBAR (lg+) ───────────────────────────────── */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border">
        <div className="sticky top-14 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <CareersLeftSidebar />
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="px-3 py-3 sm:px-4 sm:py-4 space-y-5 w-full">

          {/* HERO */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Careers at Betcheza</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 leading-tight">
              Earn commissions helping Kenya's{' '}
              <span className="text-primary">#1 sports tips platform grow</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              We're building the biggest sports betting tips community in East Africa — and we need driven, connected people to help us grow it. All our agent roles are commission-based: the more users you bring in, the more you earn. No fixed salary caps. No ceiling.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="#apply"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                Apply Now
              </a>
              {[
                { label: 'All Roles', href: '#roles' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Earnings', href: '#earnings' },
              ].map(l => (
                <a key={l.href} href={l.href} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                  {l.label}
                </a>
              ))}
            </div>

            {/* Quick stat pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: Users, label: 'Growing agent network' },
                { icon: Wallet, label: 'Weekly M-Pesa payouts' },
                { icon: Clock, label: 'Fully flexible hours' },
                { icon: MapPin, label: 'Work from anywhere in Kenya' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Icon className="h-3 w-3 text-primary shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS */}
          <section id="how-it-works" className="scroll-mt-16">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">How it works — 4 simple steps</h2>
                <p className="text-xs text-muted-foreground">No experience required. Start earning in under 24 hours.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                { step: '01', title: 'Apply below', desc: 'Fill in the quick form — name, phone, which role you want.', color: 'border-primary/20 bg-primary/5', num: 'text-primary' },
                { step: '02', title: 'We onboard you', desc: "Our team WhatsApps you, sets up your account and gives you a personal referral link.", color: 'border-blue-500/20 bg-blue-500/5', num: 'text-blue-500' },
                { step: '03', title: 'Start referring', desc: 'Share your link on WhatsApp, social media, or in person. Friends sign up under you.', color: 'border-violet-500/20 bg-violet-500/5', num: 'text-violet-500' },
                { step: '04', title: 'Get paid', desc: 'Commission hits your agent wallet instantly. Withdraw to M-Pesa weekly.', color: 'border-green-500/20 bg-green-500/5', num: 'text-green-600' },
              ].map(({ step, title, desc, color, num }) => (
                <div key={step} className={cn('rounded-xl border p-3', color)}>
                  <p className={cn('text-2xl font-black mb-2 leading-none', num)}>{step}</p>
                  <p className="text-xs font-bold text-foreground mb-1">{title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ROLES */}
          <section id="roles" className="scroll-mt-16">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Briefcase className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Open Positions</h2>
                <p className="text-xs text-muted-foreground">All roles are commission-based — no fixed salary, unlimited upside</p>
              </div>
            </div>

            <div className="space-y-3">
              {ROLES.map(role => (
                <div
                  key={role.id}
                  id={role.id}
                  className={cn(
                    'rounded-xl border p-4 scroll-mt-16',
                    role.highlight ? 'border-primary/30 bg-primary/5' : `${role.border} ${role.bg}`
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2.5">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border mt-0.5', role.border, role.bg)}>
                        <role.icon className={cn('h-3.5 w-3.5', role.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-foreground">{role.title}</h3>
                          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', role.badgeColor)}>
                            {role.badge}
                          </span>
                          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                            Remote · Flexible
                          </span>
                        </div>
                        <p className={cn('text-xs font-medium mt-0.5', role.color)}>{role.tagline}</p>
                      </div>
                    </div>
                  </div>

                  {/* Earnings highlight */}
                  <div className={cn('rounded-lg border px-3 py-2 mb-3', role.border, role.bg.replace('/5', '/10'))}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <DollarSign className={cn('h-3 w-3 shrink-0', role.color)} />
                      <span className="text-[11px] font-bold text-foreground">{role.earn}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{role.earnDetail}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* What you'll do */}
                    <div>
                      <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide mb-1.5">What you'll do</p>
                      <ul className="space-y-1">
                        {role.duties.map(d => (
                          <li key={d} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* What you need */}
                    <div>
                      <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide mb-1.5">What you need</p>
                      <ul className="space-y-1">
                        {role.skills.map(s => (
                          <li key={s} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <ChevronRight className={cn('h-3 w-3 shrink-0 mt-0.5', role.color)} />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                    <a
                      href="#apply"
                      onClick={() => set('role', role.title)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                        role.highlight
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'border border-border bg-card hover:bg-muted text-foreground'
                      )}
                    >
                      <UserPlus className="h-3 w-3" />
                      Apply for this role
                    </a>
                    <a
                      href={`https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I%27d%20like%20to%20apply%20for%20the%20${encodeURIComponent(role.title)}%20role.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp to apply
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* EARNINGS SECTION */}
          <section id="earnings" className="scroll-mt-16 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-sm font-bold text-foreground">How much can you earn?</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              There's no cap. The more users you bring in, the higher your commission rate climbs. An active agent recruiting consistently can replace a full-time income.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
              {[
                { label: 'Part-time (evenings)', refs: '15–25/month', earn: 'KES 3,000–7,500', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Active hustler', refs: '30–60/month', earn: 'KES 9,000–24,000', icon: Zap, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20' },
                { label: 'Full-time agent', refs: '80–120/month', earn: 'KES 32,000–60,000', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Top earner (Elite)', refs: '150+/month', earn: 'KES 75,000+', icon: Award, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
              ].map(({ label, refs, earn, icon: Icon, color, bg }) => (
                <div key={label} className={cn('rounded-xl border p-3', bg)}>
                  <Icon className={cn('h-4 w-4 mb-2', color)} />
                  <p className="text-xs font-bold text-foreground mb-1">{label}</p>
                  <p className="text-[10px] text-muted-foreground mb-1">{refs} referrals</p>
                  <p className={cn('text-base font-extrabold', color)}>{earn}</p>
                  <p className="text-[10px] text-muted-foreground">per month</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Note:</strong> Figures are estimates based on Sales Agent tier rates. Campus Reps earn higher rates. Affiliate Marketers with strong traffic can exceed all tiers. All commissions paid weekly to M-Pesa.
            </div>
          </section>

          {/* WHAT AGENTS SAY (social proof) */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="h-3.5 w-3.5 text-green-500" />
              <h2 className="text-sm font-bold text-foreground">From our agents</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {[
                {
                  name: 'Brian M.', location: 'Nairobi, Westlands', role: 'Sales Agent',
                  quote: "I started sharing the link on WhatsApp for fun. By month 2 I was making KES 18,000 on top of my salary. It's the easiest side hustle I've ever done.",
                  rating: 5,
                },
                {
                  name: 'Cynthia A.', location: 'Kisumu', role: 'Campus Rep — Maseno Uni',
                  quote: "My campus was easy to crack — football fans everywhere. I hit Elite tier in my third month. The dashboard makes it so easy to track who signed up.",
                  rating: 5,
                },
                {
                  name: 'James K.', location: 'Mombasa', role: 'WhatsApp Group Manager',
                  quote: "I already had a 200-member football tips group. Adding Betcheza was natural. Most of them signed up within a week. Now it pays my rent.",
                  rating: 5,
                },
              ].map(({ name, location, role, quote, rating }) => (
                <div key={name} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5 italic">"{quote}"</p>
                  <div>
                    <p className="text-xs font-bold text-foreground">{name}</p>
                    <p className="text-[10px] text-muted-foreground">{role} · {location}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* APPLICATION FORM */}
          <section id="apply" className="scroll-mt-16">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <UserPlus className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Apply Now</h2>
                <p className="text-xs text-muted-foreground">Takes 2 minutes. We'll WhatsApp you within 24 hours.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Full Name *</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Brian Mutua"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone (WhatsApp) *</label>
                    <input
                      type="tel"
                      className={inputCls}
                      placeholder="0712 345 678"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Email (optional)</label>
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="brian@gmail.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Role you're applying for *</label>
                    <select
                      className={inputCls}
                      value={form.role}
                      onChange={e => set('role', e.target.value)}
                      required
                    >
                      <option value="">Select a role…</option>
                      {ROLES.map(r => (
                        <option key={r.id} value={r.title}>{r.title}</option>
                      ))}
                      <option value="Not sure — help me decide">Not sure — help me decide</option>
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Your location</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Nairobi, Kisumu, Mombasa…"
                      value={form.location}
                      onChange={e => set('location', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Your network / audience</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. WhatsApp group (300), TikTok 5K followers…"
                      value={form.network}
                      onChange={e => set('network', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Anything else? (optional)</label>
                  <textarea
                    className={cn(inputCls, 'resize-none h-20')}
                    placeholder="Tell us why you'd be great, any questions, or your experience with sports betting…"
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                  />
                </div>

                {result && (
                  <div className={cn(
                    'rounded-lg border px-3 py-2 text-xs leading-relaxed',
                    result.ok
                      ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  )}>
                    {result.ok ? <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" /> : null}
                    {result.msg}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {submitting ? 'Submitting…' : 'Submit Application'}
                  </button>
                  <span className="text-[10px] text-muted-foreground">or</span>
                  <a
                    href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I%27d%20like%20to%20apply%20for%20an%20agent%20role."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Apply via WhatsApp
                  </a>
                </div>
              </form>
            </div>
          </section>

          {/* Footer CTA */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground mb-0.5">Have questions before applying?</p>
              <p className="text-xs text-muted-foreground">Our team is on WhatsApp daily — no calls, just messages.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="https://wa.me/254113226240"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a
                href="mailto:careers@betcheza.co.ke"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <Mail className="h-3.5 w-3.5" /> Email us
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* ── RIGHT SIDEBAR (xl+) ──────────────────────────────── */}
      <aside className="hidden xl:block w-64 shrink-0 border-l border-border">
        <div className="sticky top-14 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
          <CareersRightSidebar />
        </div>
      </aside>

    </div>
  );
}
