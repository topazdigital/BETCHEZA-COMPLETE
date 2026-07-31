'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Copy, Check, Users, Gift, Clock, TrendingUp, Share2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReferralRecord {
  id: string;
  referredUsername: string;
  referredEmail: string;
  createdAt: string;
  verifiedAt?: string;
  firstDepositAt?: string;
  firstDepositAmount?: number;
  firstBetAt?: string;
  referrerBonusPaid: boolean;
  refereeBonusPaid: boolean;
}

interface ReferralStats {
  code: string;
  referralUrl: string;
  totalReferrals: number;
  verifiedReferrals: number;
  qualifiedReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
  referrals: ReferralRecord[];
}

export default function ReferralPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/referral');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStats();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, fetchStats]);

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(type === 'code' ? 'Code copied!' : 'Link copied!');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const shareLink = async () => {
    if (!stats) return;
    const shareData = {
      title: 'Join Betcheza',
      text: "I've been getting sharp tips on Betcheza — join me and get KES 50 free!",
      url: stats.referralUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      copyToClipboard(stats.referralUrl, 'url');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Sign in to view your referrals</h2>
        <p className="text-sm text-muted-foreground">Create an account or sign in to get your referral link and earn rewards.</p>
        <Button onClick={() => openAuthModal('register')}>Get Started</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Referral Programme</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite friends to Betcheza and both of you earn rewards when they verify their account.
        </p>
      </div>

      {/* Bonus explanation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
          <p className="text-2xl font-bold text-success">KES 100</p>
          <p className="text-xs text-muted-foreground mt-1">You earn per qualified referral</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">After friend deposits + bets</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
          <p className="text-2xl font-bold text-primary">KES 50</p>
          <p className="text-xs text-muted-foreground mt-1">Your friend earns</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">On first deposit ≥ KES 200</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold">{stats?.totalReferrals ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total referred</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-success">{stats?.qualifiedReferrals ?? 0}</p>
            <p className="text-xs text-muted-foreground">Qualified</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold">KES {(stats?.totalEarned ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Share section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Referral Link</CardTitle>
          <CardDescription className="text-xs">Share this link — your friend's bonus is applied automatically when they sign up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Code */}
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-lg font-bold tracking-wider text-center">
              {stats?.code ?? '—'}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => stats && copyToClipboard(stats.code, 'code')}
            >
              {copied === 'code' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Full URL */}
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={stats?.referralUrl ?? ''}
              className="h-8 text-xs font-mono bg-muted/30"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => stats && copyToClipboard(stats.referralUrl, 'url')}
            >
              {copied === 'url' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Button className="w-full gap-2" onClick={shareLink}>
            <Share2 className="h-4 w-4" />
            Share with a Friend
          </Button>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: Share2, step: '1', text: 'Share your unique referral link or code with friends.', status: 'done' },
            { icon: Users, step: '2', text: 'Your friend signs up using your link and verifies their email.', status: 'done' },
            { icon: TrendingUp, step: '3', text: 'They make a first deposit of at least KES 200 — your friend instantly gets KES 50 added to their platform credit.', status: 'key' },
            { icon: Gift, step: '4', text: 'Once they also place their first tip or bet on the platform, you earn KES 100 credited to your account.', status: 'key' },
          ].map(({ icon: Icon, step, text, status }) => (
            <div key={step} className="flex items-start gap-3">
              <div className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                status === 'key' ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
              )}>
                {step}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </CardContent>
        <div className="px-5 pb-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
            <strong>Fair play:</strong> Both bonuses are non-withdrawable platform credits, usable for tips &amp; competitions. No-show referrals don't count — your friend must actively deposit and bet.
          </div>
        </div>
      </Card>

      {/* Referral list */}
      {stats && stats.referrals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {stats.referrals.map((ref) => {
              const steps = [
                { done: !!ref.verifiedAt, label: 'Signed up' },
                { done: !!ref.firstDepositAt, label: 'Deposited' },
                { done: !!ref.firstBetAt, label: 'Placed bet' },
              ];
              const stepsDone = steps.filter(s => s.done).length;
              const nextStep = steps.find(s => !s.done);
              return (
                <div key={ref.id} className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">@{ref.referredUsername}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Joined {new Date(ref.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {ref.referrerBonusPaid ? (
                      <span className="text-xs font-bold text-success">+KES 100 earned</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{stepsDone}/3 steps</span>
                    )}
                  </div>
                  {/* Progress steps */}
                  <div className="flex items-center gap-1">
                    {steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                          s.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {s.done ? '✓' : i + 1}
                        </div>
                        <span className={cn("text-[10px]", s.done ? "text-foreground" : "text-muted-foreground/60")}>
                          {s.label}
                        </span>
                        {i < steps.length - 1 && (
                          <div className={cn("h-px w-4", s.done ? "bg-success/50" : "bg-muted")} />
                        )}
                      </div>
                    ))}
                  </div>
                  {nextStep && !ref.referrerBonusPaid && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Waiting: {nextStep.label.toLowerCase()}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {stats && stats.referrals.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">No referrals yet</p>
          <p className="text-xs text-muted-foreground mt-1">Share your link above to start earning rewards.</p>
        </div>
      )}
    </div>
  );
}
