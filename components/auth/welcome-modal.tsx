'use client';

import { useState, useEffect } from 'react';
import { Trophy, Users, Sparkles, BarChart3, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

const STORAGE_KEY = 'bz_welcomed_v1';

const STEPS = [
  {
    icon: Sparkles,
    color: 'text-purple-500 bg-purple-500/10',
    title: 'AI Predictions',
    description: 'Get AI-powered match forecasts with win probabilities across 35+ sports — completely free.',
    cta: 'Try AI Predictor',
    href: '/predictor',
  },
  {
    icon: Users,
    color: 'text-emerald-500 bg-emerald-500/10',
    title: 'Follow Expert Tipsters',
    description: 'Discover verified tipsters ranked by real win rate and ROI. Follow them to get tip alerts.',
    cta: 'Browse Tipsters',
    href: '/tipsters',
  },
  {
    icon: Trophy,
    color: 'text-amber-500 bg-amber-500/10',
    title: 'Jackpot Tips',
    description: 'Free daily predictions for SportPesa, Betika Grand Jackpot, and other Kenyan bookmakers.',
    cta: 'View Jackpots',
    href: '/jackpots',
  },
  {
    icon: BarChart3,
    color: 'text-blue-500 bg-blue-500/10',
    title: 'Your Dashboard',
    description: 'Track your picks, manage your wallet, and climb the tipster leaderboard.',
    cta: 'Go to Dashboard',
    href: '/dashboard',
  },
];

export function WelcomeModal() {
  const { user, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === String(user.id)) return;
    } catch {}
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(user!.id)); } catch {}
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible || !user) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/20 to-emerald-500/10 p-6 text-center">
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', current.color)}>
              <Icon className="h-6 w-6" />
            </div>
          </div>

          <p className="text-xs font-medium text-primary mb-1">
            Welcome, {user.displayName || user.username}! 🎉
          </p>
          <h2 className="text-lg font-bold">{current.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1 gap-1 text-xs" onClick={dismiss}>
              <Link href={current.href}>
                {current.cta} <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
            <Button className="flex-1 gap-1 text-xs" onClick={next}>
              {step < STEPS.length - 1 ? (
                <>Next <ArrowRight className="h-3 w-3" /></>
              ) : (
                <><CheckCircle2 className="h-3 w-3" /> Done</>
              )}
            </Button>
          </div>

          <button
            onClick={dismiss}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
