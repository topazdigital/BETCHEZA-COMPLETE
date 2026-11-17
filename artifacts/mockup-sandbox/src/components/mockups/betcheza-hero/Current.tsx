import './_group.css';
import { ArrowRight, ArrowUpRight, Sparkles, Zap } from 'lucide-react';

const fixtures = [
  { league: 'International Friendly', home: 'Malaysia', away: 'Yemen', time: '09:00', odds: '–' },
  { league: 'International Friendly', home: 'Singapore', away: 'Brazil', time: '13:00', odds: '–' },
  { league: 'International Friendly', home: 'China', away: 'Bahrain', time: '15:00', odds: '1.91 · 4.20' },
];

export function Current() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-primary/5">
        <div className="px-4 py-5 sm:px-7 sm:py-7">
          <div className="grid items-center gap-5 lg:grid-cols-2 lg:gap-8">
            <div className="flex flex-col justify-center">
              <div className="mb-3 flex w-fit items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                <Zap className="h-3 w-3 text-primary" />
                Trusted by 50,000+ tipsters
              </div>
              <h1 className="mb-2 max-w-xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                The Complete Platform for{' '}
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Sports Betting Tips
                </span>
              </h1>
              <p className="mb-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Expert predictions across 35+ sports — track performance and compete worldwide.
              </p>
              <a
                href="#community"
                className="group mb-4 flex max-w-xl items-center gap-3 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950 via-emerald-800 to-emerald-600 px-4 py-3 text-white shadow-lg shadow-emerald-700/20"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-emerald-700">W</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">Betcheza community</span>
                  <span className="mt-0.5 block truncate text-sm font-bold">Get the conversation, picks &amp; match energy</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-emerald-700">
                  Join now <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </a>
              <div className="flex flex-wrap gap-2">
                <a href="#register" className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a href="#matches" className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-sm font-semibold">
                  Browse Matches
                </a>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {[
                  ['0', 'Live Now'],
                  ['63', 'Today'],
                  ['35+', 'Sports'],
                  ['50K+', 'Tipsters'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl px-1.5 py-2 text-center">
                    <div className="text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
                    <div className="text-[10px] text-muted-foreground sm:text-xs">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex lg:items-center lg:justify-center">
              <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-2xl shadow-primary/10 backdrop-blur">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Featured Matches</span>
                  <span className="ml-auto text-xs text-muted-foreground">3 picks</span>
                </div>
                <div className="space-y-2">
                  {fixtures.map((fixture) => (
                    <a key={fixture.home} href="#matches" className="block rounded-xl border border-transparent bg-muted/50 p-3 transition hover:border-primary/20 hover:bg-muted">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                        <span className="truncate">{fixture.league}</span>
                        <span>{fixture.time}</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-1 text-sm font-medium">
                        <span>{fixture.home}</span><span className="row-span-2 self-center font-mono text-xs font-bold text-primary">{fixture.odds}</span>
                        <span>{fixture.away}</span>
                      </div>
                    </a>
                  ))}
                </div>
                <a href="#matches" className="mt-3 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition hover:bg-muted">
                  Browse all matches <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
