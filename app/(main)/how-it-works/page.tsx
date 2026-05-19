'use client';

import Link from 'next/link';
import {
  Users, Trophy, TrendingUp, Swords, Star, BarChart3,
  CheckCircle2, Lock, Coins, Target, Zap, Shield,
  ChevronDown, ChevronUp, Calendar, Radio, Sparkles,
  MessageSquare, BookOpen, HelpCircle, ArrowRight,
  ThumbsUp, Award, Wallet, Phone
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-primary' }: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  color?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{number}</div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, items, color = 'text-primary', border = 'border-primary/20', bg = 'bg-primary/5' }: {
  icon: typeof CheckCircle2;
  title: string;
  items: string[];
  color?: string;
  border?: string;
  bg?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4', border, bg)}>
      <div className={cn('flex items-center gap-2 font-semibold text-sm mb-3', color)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="pb-3 text-xs text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 space-y-8">

      {/* Hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Complete Guide</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">How Betcheza Works</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Everything you need to know — from browsing matches and following tipsters, to competing in challenges, running the 3 Daily Odds strategy, and earning as a tipster yourself.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'For Bettors', href: '#bettors' },
            { label: 'For Tipsters', href: '#tipsters' },
            { label: '3 Daily Odds', href: '#strategy' },
            { label: 'Challenges', href: '#challenges' },
            { label: 'AI Predictor', href: '#ai' },
            { label: 'FAQ', href: '#faq' },
          ].map(l => (
            <a key={l.href} href={l.href} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── FOR BETTORS ───────────────────────────────────── */}
      <section id="bettors" className="scroll-mt-16">
        <SectionHeader
          icon={Users}
          title="For Bettors & Fans"
          subtitle="How to get the most out of Betcheza as a regular user"
          color="text-blue-500"
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-green-500" /> Browsing Matches</h3>
            <div className="space-y-2.5">
              <Step number={1} title="View today's matches" description="Go to Matches to see every fixture happening today, sorted by league. Filter by sport, league, or country using the sidebar." />
              <Step number={2} title="Check live scores" description="Tap Live in the sidebar to watch scores update in real time. The red Live badge shows how many matches are currently in play." />
              <Step number={3} title="Open a match for details" description="Click any match to see detailed info: team form, head-to-head record, tipster predictions, AI analysis, odds comparison, and live commentary." />
              <Step number={4} title="Compare bookmaker odds" description="Each match page shows odds from multiple bookmakers side by side so you can always get the best price." />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-orange-500" /> Following Tipsters</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Browse the Tipsters page" description="See all tipsters ranked by win rate, ROI, and recent form. Each card shows their last 10 results at a glance." />
              <Step number={2} title="Check a tipster's profile" description="Click any tipster to see their full prediction history, sport breakdown, best markets, and a performance chart. Every tip shows the final result — WON or LOST — matched to the actual match score." />
              <Step number={3} title="Follow your favourites" description="Hit Follow on a tipster's profile to get their new tips surfaced in your feed and receive notifications." />
              <Step number={4} title="Check the Leaderboard" description="The Leaderboard ranks tipsters by weekly ROI, win rate, and profit. Updated daily." />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-teal-500" /> Community Feed</h3>
            <div className="space-y-2.5">
              <Step number={1} title="See what the community is saying" description="The Community Feed shows posts from all tipsters and users — tips, analysis, match previews, and general betting discussion." />
              <Step number={2} title="Like and comment" description="Engage with posts by liking or leaving a comment. Active users get more visibility on the platform." />
              <Step number={3} title="Share your own view" description="Post your own match analysis or prediction directly from the Feed. Build your reputation even before becoming an official tipster." />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Star className="h-4 w-4 text-pink-500" /> Competitions</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Join a competition" description="Open Competitions to see active contests. Each competition has a start date, end date, prize pool, and entry fee (some are free)." />
              <Step number={2} title="Submit your picks" description="During the competition window, submit your predictions for the listed matches. You score points for correct results." />
              <Step number={3} title="Win prizes" description="At the end of the competition period, the leaderboard is finalised and prizes are distributed to the top-ranked participants." />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR TIPSTERS ─────────────────────────────────── */}
      <section id="tipsters" className="scroll-mt-16">
        <SectionHeader
          icon={Award}
          title="For Tipsters"
          subtitle="How to grow your profile, post tips, and earn on Betcheza"
          color="text-orange-500"
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ArrowRight className="h-4 w-4 text-indigo-500" /> Getting Started</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Apply to become a tipster" description="Go to Become a Tipster and fill in your profile — specialties, bio, and preferred markets. Your application is reviewed within 24 hours." />
              <Step number={2} title="Set up your profile" description="Add a photo, write your bio, list your specialties (e.g. EPL Over/Under, African football, Asian Handicap), and set your subscription price if you want to offer premium tips." />
              <Step number={3} title="Start posting tips" description="Open any match and click Post Tip. Choose the market, your pick, the odds you got, and your stake level (1–5). Add a brief analysis to explain your reasoning — this builds trust." />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-400" /> How Results Are Tracked</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Automatic result settlement" description="When a match finishes, the platform fetches the official final score and automatically settles your tip as WON or LOST based on your prediction." />
              <Step number={2} title="Your stats update instantly" description="Your win rate, ROI, and streak are recalculated after every settled tip. The performance graph on your profile updates in real time." />
              <Step number={3} title="All tips are permanent" description="You cannot delete a posted tip. This ensures full transparency — every prediction, whether won or lost, stays on your public record." />
              <Step number={4} title="Verified badge" description="Tipsters with 30+ tips and a tracked history of at least 30 days can apply for a Verified badge, which boosts visibility on the leaderboard." />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard
              icon={CheckCircle2}
              title="What makes a good tip"
              color="text-green-600"
              border="border-green-500/20"
              bg="bg-green-500/5"
              items={[
                'Real analysis, not guesswork — explain your reasoning',
                'Use actual bookmaker odds, not made-up numbers',
                'Stake 1–2 units max per tip to show discipline',
                'Specialise in 1–2 markets you know deeply',
                'Post at least 3 tips per week to stay ranked',
              ]}
            />
            <InfoCard
              icon={Trophy}
              title="How ROI is calculated"
              color="text-yellow-600"
              border="border-yellow-500/20"
              bg="bg-yellow-500/5"
              items={[
                'ROI = (total profit ÷ total staked) × 100',
                'Positive ROI means you make money long term',
                'Displayed on your profile and leaderboard',
                'Calculated from all settled tips (not pending)',
                'Reset monthly for the monthly leaderboard',
              ]}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Coins className="h-4 w-4 text-yellow-500" /> Earning as a Tipster</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Set a subscription price" description="In your profile settings, choose a weekly or monthly subscription price (in KES). Users who pay unlock your premium tips and analysis." />
              <Step number={2} title="Payouts via M-Pesa" description="Subscription revenue is collected by the platform and paid out to your M-Pesa number at the end of each month, minus the platform fee." />
              <Step number={3} title="Grow your followers" description="The more followers you have, the more subscribers you attract. Consistent performance and quality analysis are the fastest paths to growth." />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 DAILY ODDS ─────────────────────────────────── */}
      <section id="strategy" className="scroll-mt-16">
        <SectionHeader
          icon={TrendingUp}
          title="3 Daily Odds Winning Strategy"
          subtitle="How the weekly compounding plan works and how to subscribe"
          color="text-emerald-500"
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h3 className="font-semibold text-sm mb-2 text-emerald-700 dark:text-emerald-400">What is the 3 Daily Odds Strategy?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The 3 Daily Odds Strategy is a 7-day compounding betting plan. Every day, our AI selects 1–3 football matches whose combined odds multiply to between 3.0 and 4.0. You bet a set stake, and if you win, you reinvest a larger amount the next day. Over 7 days, starting from KES 1,000, the target weekly profit is KES 108,000.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">Day-by-Day Plan</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1.5 text-left font-medium">Day</th>
                    <th className="py-1.5 text-right font-medium">Stake</th>
                    <th className="py-1.5 text-right font-medium">Save</th>
                    <th className="py-1.5 text-right font-medium">Target Win</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {[
                    { d: 1, stake: '1,000', save: '—', win: '3,000' },
                    { d: 2, stake: '1,500', save: '1,500', win: '4,500' },
                    { d: 3, stake: '2,500', save: '2,000', win: '7,500' },
                    { d: 4, stake: '5,000', save: '2,500', win: '15,000' },
                    { d: 5, stake: '10,000', save: '5,000', win: '30,000' },
                    { d: 6, stake: '15,000', save: '15,000', win: '45,000' },
                    { d: 7, stake: '20,000', save: '25,000', win: '60,000' },
                  ].map(row => (
                    <tr key={row.d}>
                      <td className="py-1.5 font-medium text-foreground">Day {row.d}</td>
                      <td className="py-1.5 text-right font-mono">KES {row.stake}</td>
                      <td className="py-1.5 text-right font-mono text-blue-500">{row.save !== '—' ? `KES ${row.save}` : '—'}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-green-500">KES {row.win}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Total savings: KES 49,000 · Day 7 win: KES 60,000 · Weekly profit: KES 108,000</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Phone className="h-4 w-4 text-green-500" /> Subscribing (Weekly · KES 5,000)</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Click 3 Daily Odds Strategy in the sidebar" description="The page shows the weekly plan overview. Non-subscribers can see yesterday's picks for free." />
              <Step number={2} title="Enter your M-Pesa number and pay KES 5,000" description="An STK push is sent to your phone. Enter your PIN to confirm. The page unlocks automatically within seconds of payment." />
              <Step number={3} title="Your Day 1 starts TODAY" description="No matter what day of the week you join — Monday, Friday, Sunday — your personal 7-day plan starts the moment you pay. If you join on what is calendar Day 5, your subscription covers Days 5, 6, 7 of the current week and Days 1–4 of the next. You get exactly 7 daily picks." />
              <Step number={4} title="Renew each week" description="After 7 days your subscription expires. Pay again to continue the strategy from the next available day. You can renew early — the new 7-day window starts from the day of renewal." />
            </div>
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> Yesterday&apos;s picks are always visible for free so you can evaluate the quality of the strategy before subscribing.
            </div>
          </div>
        </div>
      </section>

      {/* ── CHALLENGES ───────────────────────────────────── */}
      <section id="challenges" className="scroll-mt-16">
        <SectionHeader
          icon={Swords}
          title="Challenges"
          subtitle="Head-to-head prediction contests between two users"
          color="text-red-500"
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">How Challenges Work</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Challenge another user" description="Go to Challenges and click New Challenge. Search for the user you want to face. Pick a match, choose your pick (Home / Draw / Away), and set a stake amount in KES." />
              <Step number={2} title="The opponent accepts or declines" description="The challenged user receives a notification. They must accept within the time limit and make their own pick for the same match. If they pick the same outcome as you, the challenge is cancelled and stakes refunded." />
              <Step number={3} title="Match kicks off" description="Once both sides have accepted, the challenge is locked. You can track the match live from the Challenges page." />
              <Step number={4} title="Winner takes the pot" description="When the match finishes, the result is automatically verified. The user whose pick is correct wins the combined stake. In the event of a draw on a 1X2 pick (both picked draw and the match draws), stakes are split." />
              <Step number={5} title="Expired challenges" description="If the opponent doesn&apos;t respond before the challenge expiry, the challenge is automatically cancelled and your stake is refunded." />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard
              icon={CheckCircle2}
              title="Challenge rules"
              color="text-green-600"
              border="border-green-500/20"
              bg="bg-green-500/5"
              items={[
                'Minimum stake: KES 100',
                'Both users must pick different outcomes',
                'Challenges locked at match kickoff',
                'Results verified from official match data',
                'Winnings paid out to your wallet instantly',
              ]}
            />
            <InfoCard
              icon={Shield}
              title="Fair play"
              color="text-blue-600"
              border="border-blue-500/20"
              bg="bg-blue-500/5"
              items={[
                'You cannot challenge yourself',
                'Admin can void a challenge if match is cancelled',
                'Disputed results are reviewed within 24h',
                'Abandoned matches: stakes refunded',
                'Only settled matches trigger payouts',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── AI PREDICTOR ─────────────────────────────────── */}
      <section id="ai" className="scroll-mt-16">
        <SectionHeader
          icon={Sparkles}
          title="AI Predictor"
          subtitle="How our AI analyses matches and generates predictions"
          color="text-purple-500"
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">What the AI Analyses</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: BarChart3, label: 'Recent form', desc: 'Last 5–10 results for each team, home and away separately.' },
                { icon: Users, label: 'Head-to-head', desc: 'Historical results between the two teams in this competition.' },
                { icon: Target, label: 'Odds movement', desc: 'How the bookmaker odds have shifted since the market opened.' },
                { icon: Zap, label: 'Expected Goals (xG)', desc: 'Attack and defence quality measured by shot quality, not just results.' },
                { icon: Calendar, label: 'Fixture congestion', desc: 'How many games each team has played recently and recovery time.' },
                { icon: Shield, label: 'Team news', desc: 'Known injuries, suspensions, and likely formations.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-2">
                  <item.icon className="h-4 w-4 shrink-0 mt-0.5 text-purple-500" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">Reading AI Predictions</h3>
            <div className="space-y-2.5">
              <Step number={1} title="Confidence score (0–100%)" description="Higher confidence means more data signals are aligned. 70%+ is the threshold where the AI considers a pick strong." />
              <Step number={2} title="Win probability breakdown" description="The AI shows separate probabilities for Home Win, Draw, and Away Win based on the full data model, not just the bookmaker implied probability." />
              <Step number={3} title="Market-specific analysis" description="For Over/Under, BTTS, and Asian Handicap picks, the AI explains the specific stats driving its recommendation — average goals per game, clean sheet rates, etc." />
              <Step number={4} title="Disagreement with market" description="When the AI probability differs significantly from the bookmaker odds, it highlights this as a potential value bet." />
            </div>
          </div>

          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-700 dark:text-yellow-400">
            <strong>Important:</strong> AI predictions are analytical tools, not guarantees. Sports outcomes are inherently unpredictable. Never bet more than you can afford to lose, and always treat AI confidence scores as one input — not a certainty.
          </div>
        </div>
      </section>

      {/* ── JACKPOTS ─────────────────────────────────────── */}
      <section className="scroll-mt-16">
        <SectionHeader
          icon={Coins}
          title="Jackpots"
          subtitle="How to find and analyse jackpot predictions"
          color="text-amber-500"
        />
        <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
          <Step number={1} title="Go to Jackpots in the sidebar" description="The Jackpots page lists all active jackpots from Kenyan and African bookmakers — SportPesa Midweek, Betika Grand, and others." />
          <Step number={2} title="Select a jackpot" description="Click on a jackpot to see all the matches included in it, with odds and our AI's recommended pick for each leg." />
          <Step number={3} title="Check community picks" description="See how the community is voting on each leg. The most popular pick per leg is highlighted." />
          <Step number={4} title="Build your combination" description="Use the AI picks as a starting point, then adjust based on your own research. Copy the full combination to your clipboard and submit it on the bookmaker's site." />
        </div>
      </section>

      {/* ── RESULTS ──────────────────────────────────────── */}
      <section className="scroll-mt-16">
        <SectionHeader
          icon={BarChart3}
          title="Results Page"
          subtitle="Where to find final scores and check your bets"
          color="text-slate-400"
        />
        <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
          <Step number={1} title="Browse completed matches" description="The Results page shows all finished matches with final scores, sorted by date. Filter by sport or league to narrow down." />
          <Step number={2} title="Verify your tips" description="Search for a specific match to see the final score and verify whether your predictions — or those of tipsters you follow — were correct." />
          <Step number={3} title="Stats and trends" description="Results feed directly into tipster statistics, leaderboard rankings, and the AI's training data to improve future predictions." />
        </div>
      </section>

      {/* ── WALLET & PAYMENTS ────────────────────────────── */}
      <section className="scroll-mt-16">
        <SectionHeader
          icon={Wallet}
          title="Wallet & Payments"
          subtitle="How funds move in and out of your account"
          color="text-green-500"
        />
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
            <Step number={1} title="Deposit via M-Pesa" description="Go to your Wallet and select Deposit. Enter your M-Pesa number and amount. An STK push is sent — enter your PIN to confirm. Funds appear instantly." />
            <Step number={2} title="Withdraw to M-Pesa" description="Request a withdrawal from your Wallet. Enter the amount and your M-Pesa number. Withdrawals are processed within 1–24 hours during business days." />
            <Step number={3} title="Challenge winnings" description="When you win a challenge, the full pot (minus platform fee) is credited to your Betcheza wallet immediately after result confirmation." />
            <Step number={4} title="Subscription payments" description="Payments for 3 Daily Odds access and tipster subscriptions are processed through M-Pesa STK push and go directly through the secure PayHero gateway." />
          </div>
          <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
            All payments are processed via <strong>PayHero</strong>, a licensed payment service provider. Betcheza never stores your M-Pesa PIN or card details.
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-16">
        <SectionHeader
          icon={HelpCircle}
          title="Frequently Asked Questions"
          subtitle="Quick answers to common questions"
          color="text-muted-foreground"
        />
        <div className="rounded-xl border border-border bg-card px-4">
          {[
            {
              q: 'Is Betcheza free to use?',
              a: 'Yes — browsing matches, viewing tipster tips, using the AI predictor, and joining the community feed are all free. Premium features (3 Daily Odds Strategy, some tipster subscriptions) require a payment.',
            },
            {
              q: 'How are tipster results verified?',
              a: 'Results are pulled automatically from official sports data providers (ESPN, SofaScore, FotMob) once a match finishes. Tips are settled against the confirmed final score — not estimated or manually entered. Every WON or LOST badge on a tip reflects a real, verified result.',
            },
            {
              q: 'What happens if I subscribe to the 3 Daily Odds on Day 4 of the calendar week?',
              a: 'Your subscription is personal — your Day 1 is the day you pay, regardless of the calendar. So if today is calendar Day 4 (Thursday), your Day 1 = Thursday. You get 7 daily picks from Thursday through the following Wednesday. After 7 days, your subscription expires and you can renew from the next available day.',
            },
            {
              q: 'Can I see yesterday\'s 3 Daily Odds picks without subscribing?',
              a: 'Yes — yesterday\'s picks are always visible for free. This lets you evaluate the quality of the strategy before deciding to subscribe.',
            },
            {
              q: 'What happens if a match in a challenge is postponed?',
              a: 'If a match is officially postponed or abandoned before 90 minutes of play, the challenge is voided and both stakes are refunded in full.',
            },
            {
              q: 'How do I know if a tipster is legit?',
              a: 'Every tip posted on Betcheza is tied to the final match result. There is no way to edit or delete a posted tip, so the stats you see — win rate, ROI, streak — are 100% based on real predictions made before matches kicked off.',
            },
            {
              q: 'How is the AI prediction different from a tipster\'s pick?',
              a: 'The AI uses statistical models and external data (form, xG, odds movement) to generate probability estimates. Tipsters use their own knowledge, research, and experience. The AI is objective and consistent; tipsters can offer insight that models miss (e.g. insider team news, tactical reads). Ideally, use both together.',
            },
            {
              q: 'Why can\'t I find a specific match?',
              a: 'Betcheza covers 35+ sports from data providers worldwide. Very niche leagues or very far-future fixtures may not yet be in the system. Major football leagues (EPL, La Liga, Serie A, Bundesliga, Ligue 1, African leagues) are always covered.',
            },
          ].map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
        <h3 className="text-base font-bold mb-1">Ready to start?</h3>
        <p className="text-sm text-muted-foreground mb-4">Create a free account and explore matches, tipsters, and AI predictions today.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/matches" className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">
            Browse Matches
          </Link>
          <Link href="/tipsters" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            View Tipsters
          </Link>
          <Link href="/strategy" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2 text-sm font-medium hover:bg-emerald-500/20 transition-colors">
            3 Daily Odds Strategy
          </Link>
        </div>
      </div>
    </div>
  );
}
