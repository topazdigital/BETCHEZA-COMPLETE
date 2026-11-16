'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

const DISMISSAL_KEY = 'betcheza-strategy-promo-dismissed-until';
const SESSION_KEY = 'betcheza-strategy-promo-shown';
const DISMISSAL_DAYS = 7;
const POPUP_DELAY_MS = 8_000;

const planDays = [
  { day: '01', label: 'Start today' },
  { day: '02', label: 'Follow the picks' },
  { day: '03', label: 'Keep your record' },
  { day: '04–07', label: 'Complete your plan' },
];

function hasActiveDismissal() {
  try {
    const dismissedUntil = Number(window.localStorage.getItem(DISMISSAL_KEY));
    return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
  } catch {
    return false;
  }
}

function wasShownThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, 'true');
  } catch {
    // The in-memory state still prevents another opening on this page.
  }
}

function saveDismissal() {
  try {
    const expiresAt = Date.now() + DISMISSAL_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISSAL_KEY, String(expiresAt));
  } catch {
    // Dismissal remains effective for this visit if storage is unavailable.
  }
}

function StrategyPlanVisual() {
  return (
    <div
      role="group"
      aria-label="A seven-day plan, beginning today"
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#10283a] p-4 text-white sm:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full border border-[#c7ef67]/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-12 h-40 w-40 rounded-full border border-[#c7ef67]/10"
      />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c7ef67]">
              Your week, mapped
            </p>
            <p className="mt-1 text-sm font-semibold text-white/90">
              7 days. One clear routine.
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c7ef67]/20 bg-[#c7ef67]/10 text-[#c7ef67]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          {planDays.map((item, index) => (
            <div
              key={item.day}
              className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-2.5"
            >
              <span
                className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[10px] font-bold tabular-nums ${
                  index === 0
                    ? 'bg-[#c7ef67] text-[#10283a]'
                    : 'bg-white/10 text-white/65'
                }`}
              >
                {index === 0 ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : item.day}
              </span>
              <span className={`text-xs ${index === 0 ? 'font-semibold text-white' : 'text-white/65'}`}>
                {item.label}
              </span>
              {index === 0 && (
                <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c7ef67]">
                  Today
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-white/60">
          <Clock3 className="h-3.5 w-3.5 text-[#c7ef67]" aria-hidden="true" />
          The plan starts when you subscribe
        </div>
      </div>
    </div>
  );
}

export function StrategyPromo() {
  const pathname = usePathname();
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (pathname !== '/' || hasActiveDismissal() || wasShownThisSession()) return;

    const timer = window.setTimeout(() => {
      if (hasActiveDismissal() || wasShownThisSession()) return;
      markShownThisSession();
      setPopupOpen(true);
    }, POPUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  function dismissPopup() {
    saveDismissal();
    setPopupOpen(false);
  }

  return (
    <>
      <section
        data-testid="strategy-home-promo"
        aria-labelledby="strategy-promo-title"
        className="relative isolate my-5 overflow-hidden rounded-[1.4rem] bg-[#10283a] text-white shadow-[0_18px_55px_-30px_rgba(16,40,58,0.65)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] bg-[radial-gradient(ellipse_at_75%_50%,rgba(199,239,103,0.12),transparent_60%)] sm:block"
        />
        <div className="relative grid gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8 lg:p-7">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#c7ef67]/25 bg-[#c7ef67]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7f69a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c7ef67]" aria-hidden="true" />
              The Betcheza weekly strategy
            </div>
            <h2
              id="strategy-promo-title"
              className="max-w-xl text-balance text-[1.7rem] font-black leading-[1.08] tracking-[-0.045em] sm:text-3xl lg:text-[2.65rem]"
            >
              Make your next seven days
              <span className="text-[#c7ef67]"> easier to follow.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-[15px]">
              A daily football-picks plan with a clear start, a simple routine, and your week laid out in one place.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/strategy"
                data-testid="strategy-home-cta"
                className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#c7ef67] px-5 py-3 text-sm font-bold text-[#10283a] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#d7f69a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c7ef67] motion-reduce:transform-none motion-reduce:transition-none"
              >
                Explore the 7-day plan
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </Link>
              <p className="text-xs text-white/65">
                <span className="font-semibold text-white">KES 5,000</span> per week
                <span className="mx-2 text-white/30" aria-hidden="true">/</span>
                No guaranteed outcomes
              </p>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c7ef67]/80" aria-hidden="true" />
              Picks are for information, not a promise of returns. Bet responsibly and only what you can afford to lose.
            </p>
          </div>

          <div className="lg:pl-2">
             <StrategyPlanVisual />
          </div>
        </div>
      </section>

      <Dialog
        open={popupOpen}
        onOpenChange={(open) => {
          if (!open && popupOpen) dismissPopup();
          else setPopupOpen(open);
        }}
      >
        <DialogContent
          data-testid="strategy-promo-popup"
          showCloseButton={false}
          className="max-h-[min(90dvh,760px)] w-[calc(100%-1rem)] max-w-[min(34rem,calc(100%-1rem))] overflow-y-auto rounded-[1.4rem] border border-[#d9e2d0] bg-[#f5f7ef] p-0 text-[#10283a] shadow-[0_28px_90px_-30px_rgba(7,22,31,0.65)] duration-200 motion-reduce:animate-none motion-reduce:transition-none sm:w-[calc(100%-2rem)]"
        >
          <div className="relative overflow-hidden rounded-[inherit]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-[#10283a]/[0.07]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[#10283a]/[0.07]"
            />
            <div className="relative p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#557b28]/20 bg-[#c7ef67]/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#345017]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#557b28]" aria-hidden="true" />
                  A plan for the week ahead
                </div>
                <button
                  type="button"
                  data-testid="strategy-promo-dismiss"
                  onClick={dismissPopup}
                  aria-label="Close strategy promotion"
                  className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#506575] transition-colors hover:bg-[#10283a]/[0.07] hover:text-[#10283a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#557b28] motion-reduce:transition-none"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <DialogTitle className="max-w-lg text-balance text-[1.8rem] font-black leading-[1.04] tracking-[-0.05em] sm:text-[2.35rem]">
                Football picks, with a
                <span className="text-[#537728]"> seven-day rhythm.</span>
              </DialogTitle>
              <DialogDescription className="mt-3 max-w-xl text-sm leading-relaxed text-[#526675]">
                Follow Betcheza&apos;s daily picks through a personal 7-day plan. Your plan begins on the day you subscribe.
              </DialogDescription>

              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_0.88fr] sm:items-stretch">
                <StrategyPlanVisual />
                <div className="flex flex-col justify-between rounded-2xl border border-[#dce4d6] bg-white/75 p-4 sm:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7f7d]">
                      Weekly access
                    </p>
                    <p className="mt-2 flex items-baseline gap-1.5 text-[#10283a]">
                      <span className="text-3xl font-black tracking-[-0.05em]">KES 5,000</span>
                    </p>
                    <p className="mt-1 text-xs text-[#6b7a82]">per week · 7-day plan</p>
                    <div className="my-4 h-px bg-[#e0e7da]" />
                    <ul className="space-y-2.5 text-xs leading-relaxed text-[#405563]">
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#557b28]" aria-hidden="true" />
                        Daily football picks, organized by plan day
                      </li>
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#557b28]" aria-hidden="true" />
                        Start your week when you subscribe
                      </li>
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#557b28]" aria-hidden="true" />
                        See the full details before deciding
                      </li>
                    </ul>
                  </div>
                  <div className="mt-5">
                    <Link
                      href="/strategy"
                      data-testid="strategy-popup-cta"
                      className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#10283a] px-4 py-3 text-sm font-bold text-white transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#1c3d50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#557b28] motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      View the strategy
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </Link>
                    <p className="mt-2 text-center text-[10px] text-[#78858b]">
                      Explore the plan and payment options
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-4 flex items-start gap-2 border-t border-[#dce4d6] pt-3 text-[11px] leading-relaxed text-[#65747a]">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#557b28]" aria-hidden="true" />
                Betting involves risk and picks can lose. No outcome is guaranteed. Bet responsibly, and never wager money you cannot afford to lose.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
