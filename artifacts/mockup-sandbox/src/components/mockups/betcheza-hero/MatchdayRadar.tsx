import './_group.css';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MessageCircle,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react';

const mainMatch = {
  league: 'International Friendly',
  home: 'China',
  away: 'Bahrain',
  homeCode: 'CHN',
  awayCode: 'BHR',
  kickoff: '15:00',
  odds: [
    { label: 'China', value: '1.91' },
    { label: 'Bahrain', value: '4.20' },
  ],
};

const nextMatches = [
  { time: '09:00', home: 'Malaysia', away: 'Yemen', league: 'International Friendly' },
  { time: '13:00', home: 'Singapore', away: 'Brazil', league: 'International Friendly' },
];

function Crest({ code, tone }: { code: string; tone: 'blue' | 'mint' }) {
  return (
    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-xs font-black tracking-wide shadow-lg sm:h-16 sm:w-16 ${
      tone === 'blue'
        ? 'border-blue-200/20 bg-gradient-to-br from-blue-300 to-blue-600 text-white'
        : 'border-emerald-100/20 bg-gradient-to-br from-emerald-200 to-teal-500 text-slate-950'
    }`}>
      {code}
    </div>
  );
}

export function MatchdayRadar() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_78%_38%,rgba(37,99,235,0.22),transparent_35%),linear-gradient(125deg,#07111f_0%,#0b1830_55%,#0c2532_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-44 h-[34rem] w-[34rem] rounded-full border border-white/[0.06]">
          <div className="absolute inset-10 rounded-full border border-white/[0.05]" />
          <div className="absolute inset-24 rounded-full border border-white/[0.04]" />
          <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-[linear-gradient(0deg,rgba(16,185,129,0.08),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-7 sm:px-7 sm:py-9 lg:grid-cols-[1.02fr_.98fr] lg:gap-10 lg:px-10 lg:py-12">
          <div className="relative z-10">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Betcheza matchday radar
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                Matchday
              </span>
            </div>

            <h1 className="max-w-2xl text-balance text-[2.55rem] font-black leading-[0.98] tracking-[-0.055em] sm:text-5xl lg:text-[4.15rem]">
              Every matchday.
              <span className="mt-1 block bg-gradient-to-r from-cyan-200 via-blue-300 to-emerald-200 bg-clip-text text-transparent">
                Every signal.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Live scores, upcoming fixtures, real odds and tipster picks — all in one clear view across 35+ sports.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <a href="#matches" className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:shadow-blue-500/35">
                Explore today&apos;s matches
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a href="#live" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:bg-white/10">
                <Radio className="h-4 w-4 text-emerald-300" />
                Open live center
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/10 pt-5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200"><Radio className="h-4 w-4" /></span>
                <span><b className="block text-sm tabular-nums">0</b><small className="text-[10px] text-slate-400">Live now</small></span>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-300/10 text-blue-200"><CalendarDays className="h-4 w-4" /></span>
                <span><b className="block text-sm tabular-nums">63</b><small className="text-[10px] text-slate-400">Today&apos;s fixtures</small></span>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><Users className="h-4 w-4" /></span>
                <span><b className="block text-sm">50K+</b><small className="text-[10px] text-slate-400">Tipsters</small></span>
              </div>
            </div>

            <a href="#community" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-300 transition hover:text-white">
              <MessageCircle className="h-4 w-4 text-emerald-300" />
              Join the Betcheza community
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-blue-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-900/80 p-4 shadow-[0_28px_90px_-32px_rgba(37,99,235,0.6)] backdrop-blur-xl sm:p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Match spotlight</p>
                  <p className="mt-1 text-xs font-medium text-slate-200">{mainMatch.league}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/15 bg-blue-300/10 px-2.5 py-1.5 text-[10px] font-bold text-blue-100">
                  <Clock3 className="h-3 w-3 text-cyan-200" />
                  15:00 EAT
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.12),transparent_70%),rgba(255,255,255,0.025)] px-3 py-5 sm:px-5 sm:py-6">
                <div className="flex items-center justify-center gap-3 sm:gap-6">
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <Crest code={mainMatch.homeCode} tone="blue" />
                    <span className="mt-3 max-w-full truncate text-sm font-bold sm:text-base">{mainMatch.home}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[9px] font-black tracking-[0.18em] text-slate-400">VS</span>
                    <span className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Friendly</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <Crest code={mainMatch.awayCode} tone="mint" />
                    <span className="mt-3 max-w-full truncate text-sm font-bold sm:text-base">{mainMatch.away}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {mainMatch.odds.map((odd) => (
                    <div key={odd.label} className="rounded-xl border border-white/[0.07] bg-slate-950/55 px-3 py-2.5 text-center">
                      <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">{odd.label}</span>
                      <span className="mt-1 block font-mono text-base font-bold text-cyan-100">{odd.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-400">Odds are shown as provided by listed bookmakers.</span>
                <a href="#match" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-blue-200 transition hover:text-white">
                  Match centre <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Up next</span>
                  <span className="text-[10px] text-slate-500">2 fixtures</span>
                </div>
                <div className="space-y-1.5">
                  {nextMatches.map((match) => (
                    <a key={match.home} href="#matches" className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.05]">
                      <span className="w-10 shrink-0 font-mono text-[11px] font-bold text-slate-300">{match.time}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-white">{match.home} <span className="font-normal text-slate-500">vs</span> {match.away}</span>
                        <span className="mt-0.5 block truncate text-[9px] text-slate-500">{match.league}</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-3 -right-3 -z-10 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
