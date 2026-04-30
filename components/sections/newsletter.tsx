'use client';

import { useState } from 'react';
import { Mail, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, topics: ['daily_tips', 'big_matches'] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Subscription failed');
      setDone(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="my-8 w-full">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-blue-500/10 px-6 py-8 sm:px-10 sm:py-12">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" /> Free daily tips
            </div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Get the day&apos;s best tips, straight to your inbox
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Hand-picked predictions for the biggest matches every morning. No spam, unsubscribe
              anytime.
            </p>
          </div>

          <form onSubmit={submit} className="flex w-full flex-col gap-3">
            {done ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
                <Check className="h-5 w-5" />
                <div>
                  <p className="font-semibold">You&apos;re in!</p>
                  <p className="text-sm">Check your inbox for our welcome email.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                      className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || !email}
                    className="h-11 bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 sm:w-auto"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe'}
                  </Button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <p className="text-[11px] text-muted-foreground">
                  By subscribing you agree to our{' '}
                  <a href="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </a>
                  .
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
