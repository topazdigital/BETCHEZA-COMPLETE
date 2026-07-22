'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import {
  Users, Wallet, TrendingUp, Award, Clock, CheckCircle2, XCircle,
  Copy, Check, Share2, ChevronRight, Loader2, BadgeCheck, Flame,
  BarChart3, Star, UserPlus, MessageCircle, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Application {
  id: number;
  name: string;
  phone: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'contacted';
  created_at: string;
  notes: string | null;
}

interface Referral {
  id: string;
  referredUsername: string;
  createdAt: string;
  verifiedAt?: string;
  firstDepositAt?: string;
  firstBetAt?: string;
  referrerBonusPaid: boolean;
}

interface AgentData {
  ok: boolean;
  applications: Application[];
  referralStats: {
    code: string;
    referralUrl: string;
    totalReferrals: number;
    verifiedReferrals: number;
    qualifiedReferrals: number;
    pendingReferrals: number;
    totalEarned: number;
    referrals: Referral[];
  } | null;
  agentTier: {
    tier: string;
    rate: number;
    nextTier: { name: string; threshold: number } | null;
    qualifiedThisMonth: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: 'Under Review',  color: 'text-amber-600 bg-amber-500/10 border-amber-500/25',  icon: Clock },
  approved:  { label: 'Approved ✓',    color: 'text-green-700 bg-green-500/10 border-green-500/25',  icon: CheckCircle2 },
  contacted: { label: 'We Contacted You', color: 'text-blue-700 bg-blue-500/10 border-blue-500/25', icon: MessageCircle },
  rejected:  { label: 'Not Approved',  color: 'text-rose-700 bg-rose-500/10 border-rose-500/25',    icon: XCircle },
};

const TIER_COLORS: Record<string, string> = {
  Starter: 'text-slate-600 bg-slate-500/10 border-slate-500/20',
  Active:  'text-blue-700 bg-blue-500/10 border-blue-500/20',
  Pro:     'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
  Elite:   'text-amber-700 bg-amber-500/10 border-amber-500/20',
};

export default function AgentDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [data, setData]     = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/agent');
      if (res.ok) setData(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user) fetchData();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, fetchData]);

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(type === 'code' ? 'Code copied!' : 'Link copied!');
      setTimeout(() => setCopied(null), 2000);
    } catch { toast.error('Could not copy'); }
  };

  const shareLink = async () => {
    if (!data?.referralStats) return;
    const shareData = {
      title: 'Join Betcheza',
      text: "Sign up on Betcheza — Kenya's #1 sports tips platform!",
      url: data.referralStats.referralUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      copyToClipboard(data.referralStats.referralUrl, 'url');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Sign in to view your Agent Dashboard</h2>
        <p className="text-sm text-muted-foreground">Create an account or sign in to see your application status and referral earnings.</p>
        <button
          onClick={() => openAuthModal('register')}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Get Started Free
        </button>
        <Link href="/careers" className="text-xs text-primary hover:underline">
          Apply as an Agent →
        </Link>
      </div>
    );
  }

  const tier = data?.agentTier;
  const stats = data?.referralStats;
  const apps = data?.applications ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-3 sm:p-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Agent Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track your applications, referrals, and commission earnings.
          </p>
        </div>
        <Link
          href="/careers"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Apply / View Roles
        </Link>
      </div>

      {/* Agent Tier card */}
      {tier && (
        <div className={cn('rounded-xl border p-4', TIER_COLORS[tier.tier])}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="text-sm font-bold">{tier.tier} Agent</span>
            </div>
            <span className="text-xs font-semibold">KES {tier.rate.toLocaleString()}/user</span>
          </div>
          {tier.nextTier ? (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>{tier.qualifiedThisMonth} qualified users</span>
                <span>{tier.nextTier.threshold} needed for {tier.nextTier.name}</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-current opacity-60 transition-all"
                  style={{ width: `${Math.min(100, (tier.qualifiedThisMonth / tier.nextTier.threshold) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] mt-1 opacity-70">
                {tier.nextTier.threshold - tier.qualifiedThisMonth} more qualified users to reach {tier.nextTier.name} ({tier.nextTier.name === 'Active' ? 'KES 300' : tier.nextTier.name === 'Pro' ? 'KES 400' : 'KES 500'}/user)
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Flame className="h-3 w-3" />
              <span>You're at the top tier! Maximum commission rate unlocked.</span>
            </div>
          )}
        </div>
      )}

      {/* Earnings stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Referred',  value: stats.totalReferrals,     icon: Users,     color: 'text-blue-600' },
            { label: 'Qualified',       value: stats.qualifiedReferrals,  icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Total Earned',    value: `KES ${stats.totalEarned.toLocaleString()}`, icon: Wallet, color: 'text-primary' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
              <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
              <p className="text-lg font-bold tabular-nums">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Application Status cards */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          Your Applications
        </h2>

        {apps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">No applications yet</p>
            <p className="text-xs text-muted-foreground mb-3">Apply for an agent role to start earning commissions.</p>
            <Link
              href="/careers#apply"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Apply Now — It's Free
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {apps.map(app => {
              const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={app.id} className={cn('rounded-xl border p-3', cfg.color)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{app.role}</span>
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.color)}>
                          <cfg.icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-70 mt-0.5">
                        Applied {new Date(app.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {app.notes && (
                        <p className="text-[11px] mt-1 opacity-80 italic">Note: {app.notes}</p>
                      )}
                    </div>
                  </div>
                  {app.status === 'pending' && (
                    <p className="text-[11px] mt-2 opacity-70">
                      Our team reviews applications within 24–48 hours and will WhatsApp you on <strong>{app.phone}</strong>.
                    </p>
                  )}
                  {app.status === 'approved' && (
                    <p className="text-[11px] mt-2 opacity-80">
                      🎉 Congratulations! You're approved. Share your referral link below to start earning.
                    </p>
                  )}
                  {app.status === 'contacted' && (
                    <p className="text-[11px] mt-2 opacity-80">
                      We've reached out to you via WhatsApp. Check your messages on <strong>{app.phone}</strong>.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Referral link */}
      {stats && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            Your Referral / Agent Link
          </h2>

          {/* Code */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-lg font-bold tracking-widest text-center">
              {stats.code}
            </div>
            <button
              onClick={() => copyToClipboard(stats.code, 'code')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              {copied === 'code' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Full URL */}
          <div className="flex items-center gap-2 mb-3">
            <input
              readOnly
              value={stats.referralUrl}
              className="flex-1 h-8 rounded-lg border border-border bg-muted/30 px-2 text-xs font-mono text-foreground"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => copyToClipboard(stats.referralUrl, 'url')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              {copied === 'url' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>

          <button
            onClick={shareLink}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share with Friends
          </button>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Every person who signs up via your link is tracked and credited to you automatically.
          </p>
        </div>
      )}

      {/* Referrals list */}
      {stats && stats.referrals.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Users You Brought In
            </h2>
            <span className="text-xs text-muted-foreground">{stats.referrals.length} total</span>
          </div>
          <div className="divide-y divide-border">
            {stats.referrals.map(ref => {
              const steps = [
                { done: !!ref.verifiedAt,    label: 'Signed up' },
                { done: !!ref.firstDepositAt, label: 'Deposited' },
                { done: !!ref.firstBetAt,     label: 'Placed bet' },
              ];
              const stepsDone = steps.filter(s => s.done).length;
              return (
                <div key={ref.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">@{ref.referredUsername}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Joined {new Date(ref.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {ref.referrerBonusPaid ? (
                      <span className="text-xs font-bold text-green-600">+KES {tier?.rate ?? 200} earned</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{stepsDone}/3 steps</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                          s.done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground',
                        )}>
                          {s.done ? '✓' : i + 1}
                        </div>
                        <span className={cn('text-[10px]', s.done ? 'text-foreground' : 'text-muted-foreground/60')}>
                          {s.label}
                        </span>
                        {i < steps.length - 1 && (
                          <div className={cn('h-px w-4', s.done ? 'bg-green-500/50' : 'bg-muted')} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats && stats.referrals.length === 0 && apps.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">No referrals yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Share your link above to start bringing in users and earning commissions.</p>
          <a
            href="https://wa.me/254113226240?text=Hi%20Betcheza%2C%20I%20just%20applied%20and%20want%20to%20start%20sharing%20my%20link."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp us to get started
          </a>
        </div>
      )}

      {/* Commission breakdown */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          Commission Tiers
        </h2>
        <div className="space-y-2">
          {[
            { name: 'Starter', users: '1–20/month',   rate: 'KES 200/user', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
            { name: 'Active',  users: '21–50/month',  rate: 'KES 300/user', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
            { name: 'Pro',     users: '51–100/month', rate: 'KES 400/user', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
            { name: 'Elite',   users: '100+/month',   rate: 'KES 500/user', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
          ].map(t => (
            <div key={t.name} className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2',
              t.color,
              tier?.tier === t.name ? 'ring-2 ring-current ring-offset-1' : '',
            )}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold">{t.name}</span>
                {tier?.tier === t.name && <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">← You</span>}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold">{t.rate}</p>
                <p className="text-[10px] opacity-70">{t.users}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Tiers reset monthly. Payouts weekly via M-Pesa (min KES 500).</p>
      </div>

    </div>
  );
}
