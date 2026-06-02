import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  ChevronLeft, MapPin, Calendar, Ruler, Weight,
  Trophy, GitCompareArrows, Briefcase, Star,
  TrendingUp, Activity, Shield, Zap, Target,
} from 'lucide-react';
import { getSiteSettings } from '@/lib/site-settings';
import { extractNumericPlayerId } from '@/lib/utils/slug';
import { teamHref } from '@/lib/utils/slug';
import { FollowPlayerButton } from '@/components/players/follow-player-button';
import { PlayerHeroImage } from '@/components/players/player-hero-image';

interface PlayerProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  jersey?: string;
  team?: { id?: string; name?: string; logo?: string } | null;
  height?: string;
  weight?: string;
  age?: number;
  dateOfBirth?: string;
  birthPlace?: { city?: string; country?: string };
  nationality?: string;
  flag?: string;
  experienceYears?: number;
  status?: string;
  headshot?: string;
  sportPath?: string;
  stats?: unknown;
  recentMatches?: GameLogRow[];
}

interface GameLogRow {
  date?: string;
  opponent?: { name?: string; abbr?: string; logo?: string };
  homeAway?: 'home' | 'away';
  result?: string;
  score?: string;
  stats: Record<string, string>;
  competition?: string;
  competitionShort?: string;
}

async function getPlayer(id: string): Promise<PlayerProfile | null> {
  const baseUrl = process.env.INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  try {
    const r = await fetch(`${baseUrl}/api/players/${id}`, { next: { revalidate: 1800 } });
    if (!r.ok) return null;
    return (await r.json()) as PlayerProfile;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [player, settings] = await Promise.all([getPlayer(id), getSiteSettings()]);
  if (!player) return { title: `Player not found · ${settings.site_name}` };
  const teamPart = player.team?.name ? ` — ${player.team.name}` : '';
  const positionPart = player.position ? ` (${player.position})` : '';
  const title = `${player.name}${positionPart}${teamPart} · ${settings.site_name}`;
  const description = `${player.name}${teamPart}${player.nationality ? ` — ${player.nationality}` : ''}. Stats, profile and recent matches on ${settings.site_name}.`;
  return {
    title,
    description,
    openGraph: { title, description, images: player.headshot ? [{ url: player.headshot }] : undefined },
  };
}

interface StatRow { name?: string; displayName?: string; displayValue?: string; value?: number }
interface StatCategory { name?: string; displayName?: string; stats?: StatRow[] }
interface AthleteStats {
  splits?: { categories?: StatCategory[] };
  categories?: StatCategory[];
}

function extractStatCategories(stats: unknown): StatCategory[] {
  if (!stats || typeof stats !== 'object') return [];
  const s = stats as AthleteStats;
  return s.splits?.categories || s.categories || [];
}

function pickHeadlineStats(categories: StatCategory[]): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const headline: Array<{ label: string; value: string }> = [];
  const wanted = ['goals', 'assists', 'appearances', 'points', 'rebounds', 'wins', 'minutes', 'saves', 'tackles', 'passes', 'blocks', 'steals', 'interceptions', 'rating'];
  for (const cat of categories) {
    for (const s of cat.stats || []) {
      const name = (s.name || s.displayName || '').toLowerCase();
      if (!name || seen.has(name)) continue;
      if (!wanted.some(w => name.includes(w))) continue;
      const value = s.displayValue ?? (s.value !== undefined ? String(s.value) : '');
      if (!value || value === '0' || value === '0.0') continue;
      headline.push({ label: s.displayName || s.name || name, value });
      seen.add(name);
      if (headline.length >= 6) return headline;
    }
  }
  return headline;
}

function getPositionStyle(position?: string): { badge: string; glow: string } {
  const p = (position || '').toLowerCase();
  if (p.includes('goalkeeper') || p.includes('goalie') || p === 'gk')
    return { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', glow: 'from-amber-900/40' };
  if (p.includes('defender') || p.includes('back') || p === 'cb' || p === 'lb' || p === 'rb')
    return { badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30', glow: 'from-sky-900/40' };
  if (p.includes('midfield') || p === 'cm' || p === 'dm' || p === 'am')
    return { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', glow: 'from-emerald-900/40' };
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p === 'st' || p === 'cf')
    return { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', glow: 'from-rose-900/40' };
  return { badge: 'bg-primary/20 text-primary border-primary/30', glow: 'from-primary/20' };
}

const COMPETITION_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  'Premier League':     { bg: 'bg-purple-500/15', text: 'text-purple-300', ring: 'ring-purple-500/20' },
  'Champions League':   { bg: 'bg-blue-500/15',   text: 'text-blue-300',   ring: 'ring-blue-500/20' },
  'Europa League':      { bg: 'bg-orange-500/15', text: 'text-orange-300', ring: 'ring-orange-500/20' },
  'Conference League':  { bg: 'bg-green-500/15',  text: 'text-green-300',  ring: 'ring-green-500/20' },
  'La Liga':            { bg: 'bg-red-500/15',     text: 'text-red-300',    ring: 'ring-red-500/20' },
  'Serie A':            { bg: 'bg-blue-500/15',    text: 'text-blue-300',   ring: 'ring-blue-500/20' },
  'Bundesliga':         { bg: 'bg-yellow-500/15',  text: 'text-yellow-300', ring: 'ring-yellow-500/20' },
  'Ligue 1':            { bg: 'bg-indigo-500/15',  text: 'text-indigo-300', ring: 'ring-indigo-500/20' },
  'NBA':                { bg: 'bg-red-500/15',     text: 'text-red-300',    ring: 'ring-red-500/20' },
  'NFL':                { bg: 'bg-blue-500/15',    text: 'text-blue-300',   ring: 'ring-blue-500/20' },
};

function compStyle(name?: string) {
  return COMPETITION_STYLES[name || ''] || { bg: 'bg-white/10', text: 'text-white/60', ring: 'ring-white/10' };
}

function getCatIcon(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('offens') || n.includes('attack') || n.includes('goal') || n.includes('shot')) return <Target className="h-3.5 w-3.5" />;
  if (n.includes('defens') || n.includes('tackle') || n.includes('block')) return <Shield className="h-3.5 w-3.5" />;
  if (n.includes('pass') || n.includes('creat') || n.includes('assist')) return <Zap className="h-3.5 w-3.5" />;
  if (n.includes('general') || n.includes('misc') || n.includes('disciplin')) return <Activity className="h-3.5 w-3.5" />;
  return <TrendingUp className="h-3.5 w-3.5" />;
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const numericId = extractNumericPlayerId(String(player.id)) || player.id;
  const sportRoot = player.sportPath?.split('/')[0] || 'soccer';
  const categories = extractStatCategories(player.stats);
  const headlineStats = pickHeadlineStats(categories);
  const recent = player.recentMatches || [];
  const { badge: positionBadge, glow: positionGlow } = getPositionStyle(player.position);

  const statCategories = categories.map(cat => {
    const rows = (cat.stats || []).filter(s => {
      const v = s.displayValue ?? (s.value !== undefined ? String(s.value) : '');
      return v && v !== '0' && v !== '0.0' && v !== '-' && v !== '';
    });
    return { ...cat, filteredStats: rows };
  }).filter(cat => cat.filteredStats.length > 0);

  const uniqueCompetitions = Array.from(new Set(recent.map(r => r.competition).filter(Boolean))) as string[];
  const showCompetitionCol = uniqueCompetitions.length > 1;

  return (
    <div className="w-full">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden bg-slate-950">
        {/* Layered gradients */}
        <div className={`absolute inset-0 bg-gradient-to-br ${positionGlow} via-slate-900 to-slate-950`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,119,198,0.15),transparent)]" />

        {/* Blurred player photo backdrop */}
        {player.headshot && (
          <div
            className="absolute inset-0 opacity-[0.07] scale-110"
            style={{ backgroundImage: `url(${player.headshot})`, backgroundSize: 'cover', backgroundPosition: 'center top', filter: 'blur(48px)' }}
          />
        )}

        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Nav row */}
          <div className="flex items-center justify-between pt-4 pb-2">
            <Link href="/matches" className="inline-flex items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/60 hover:text-white/90 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/players/compare?a=${encodeURIComponent(numericId)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:text-white transition-colors ring-1 ring-white/10"
              >
                <GitCompareArrows className="h-3 w-3" />
                Compare
              </Link>
            </div>
          </div>

          {/* Hero body */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 pb-8 pt-3 items-center sm:items-end">

            {/* Photo */}
            <div className="relative shrink-0 self-center sm:self-end">
              <div className="absolute -inset-3 rounded-3xl opacity-40 blur-2xl bg-gradient-to-b from-white/10 to-transparent" />
              <PlayerHeroImage
                headshot={player.headshot}
                name={player.name}
                id={numericId}
                sport={sportRoot}
                size={240}
                className="relative h-48 w-40 sm:h-60 sm:w-48 rounded-2xl object-cover object-top shadow-2xl ring-2 ring-white/10"
                fallbackClassName="relative flex h-48 w-40 sm:h-60 sm:w-48 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-7xl font-black text-white/30 shadow-2xl ring-2 ring-white/10"
              />
              {player.jersey && (
                <div className="absolute -top-2.5 -right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-black text-white shadow-xl ring-3 ring-slate-950 ring-offset-0">
                  {player.jersey}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left space-y-3 pb-1">

              {/* Badges */}
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                {player.position && (
                  <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest ${positionBadge}`}>
                    {player.position}
                  </span>
                )}
                {player.nationality && player.flag && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 border border-white/10 px-3 py-0.5 text-[11px] font-medium text-white/70">
                    <Image src={player.flag} alt={player.nationality} width={14} height={10} className="rounded-sm object-cover" unoptimized />
                    {player.nationality}
                  </span>
                )}
                {player.status && player.status.toLowerCase() !== 'active' && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-0.5 text-[11px] font-semibold text-amber-300">
                    {player.status}
                  </span>
                )}
                {player.experienceYears !== undefined && player.experienceYears > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/10 px-3 py-0.5 text-[11px] text-white/50">
                    <Briefcase className="h-2.5 w-2.5" />
                    {player.experienceYears}y pro
                  </span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight leading-[1.05] [text-shadow:0_2px_20px_rgba(0,0,0,0.5)]">
                {player.name}
              </h1>

              {/* Team */}
              {player.team?.name && (
                <div>
                  {player.team.id ? (
                    <Link
                      href={teamHref(player.team.name, player.team.id)}
                      className="inline-flex items-center gap-2.5 rounded-xl bg-white/8 hover:bg-white/12 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors ring-1 ring-white/10 backdrop-blur-sm"
                    >
                      {player.team.logo && (
                        <Image src={player.team.logo} alt={player.team.name} width={24} height={24} className="h-5 w-5 object-contain drop-shadow-sm" unoptimized />
                      )}
                      {player.team.name}
                    </Link>
                  ) : (
                    <div className="inline-flex items-center gap-2.5 rounded-xl bg-white/8 px-4 py-2 text-sm font-semibold text-white/70 ring-1 ring-white/10">
                      {player.team.logo && (
                        <Image src={player.team.logo} alt={player.team.name} width={24} height={24} className="h-5 w-5 object-contain" unoptimized />
                      )}
                      {player.team.name}
                    </div>
                  )}
                </div>
              )}

              {/* Headline stats */}
              {headlineStats.length > 0 && (
                <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 pt-1">
                  {headlineStats.map((s, i) => (
                    <div key={i} className="rounded-2xl bg-white/8 backdrop-blur-sm px-4 py-2.5 text-center min-w-[72px] ring-1 ring-white/10 hover:bg-white/12 transition-colors">
                      <div className="text-xl sm:text-2xl font-black text-white leading-none tabular-nums">{s.value}</div>
                      <div className="mt-1 text-[9px] uppercase tracking-widest text-white/45 leading-none">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow CTA */}
            <div className="shrink-0 self-center sm:self-end pb-1">
              <FollowPlayerButton
                playerId={numericId}
                playerName={player.name}
                playerHeadshot={player.headshot}
                teamId={player.team?.id}
                teamName={player.team?.name}
                teamLogo={player.team?.logo}
                sportSlug={sportRoot}
                variant="default"
              />
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>

      {/* ── BIO STRIP ────────────────────────────────────────────── */}
      {(player.age || player.height || player.weight || player.birthPlace?.city || player.dateOfBirth) && (
        <div className="w-full border-b border-border bg-muted/30">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 overflow-x-auto">
            <div className="flex items-center gap-6 text-sm whitespace-nowrap min-w-max">
              {player.age && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-xs text-muted-foreground/70">Age</span>
                  <span className="font-semibold text-foreground">{player.age}</span>
                </div>
              )}
              {player.height && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-xs text-muted-foreground/70">Height</span>
                  <span className="font-semibold text-foreground">{player.height}</span>
                </div>
              )}
              {player.weight && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Weight className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-xs text-muted-foreground/70">Weight</span>
                  <span className="font-semibold text-foreground">{player.weight}</span>
                </div>
              )}
              {player.dateOfBirth && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-xs text-muted-foreground/70">DOB</span>
                  <span className="font-semibold text-foreground">
                    {new Date(player.dateOfBirth).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              {(player.birthPlace?.city || player.birthPlace?.country) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                  <span className="text-xs text-muted-foreground/70">Born</span>
                  <span className="font-semibold text-foreground">
                    {[player.birthPlace.city, player.birthPlace.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {player.team?.name && (
                <div className="ml-auto flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-primary/60" />
                  <span className="text-xs text-muted-foreground">Get match alerts for {player.name}</span>
                  <FollowPlayerButton
                    playerId={numericId}
                    playerName={player.name}
                    playerHeadshot={player.headshot}
                    teamId={player.team?.id}
                    teamName={player.team?.name}
                    teamLogo={player.team?.logo}
                    sportSlug={sportRoot}
                    variant="compact"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* ── SEASON STATS ──────────────────────────────────────── */}
        {statCategories.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">Season Statistics</h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {statCategories.map((cat, i) => {
                const numericStats = cat.filteredStats
                  .map(s => ({ ...s, numVal: parseFloat(s.displayValue || String(s.value ?? 0)) || 0 }));
                const maxVal = Math.max(...numericStats.map(s => s.numVal), 1);

                return (
                  <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                      <span className="text-primary/70">{getCatIcon(cat.displayName || cat.name)}</span>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {cat.displayName || cat.name || 'Statistics'}
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {numericStats.map((s, j) => {
                        const pct = Math.min(100, (s.numVal / maxVal) * 100);
                        return (
                          <div key={j} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                                {s.displayName || s.name}
                              </div>
                              <div className="mt-1 h-1 w-full rounded-full bg-border overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/50 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-base font-black tabular-nums text-foreground shrink-0 min-w-[40px] text-right">
                              {s.displayValue ?? s.value ?? '—'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── RECENT MATCHES ───────────────────────────────────── */}
        {recent.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Trophy className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">Recent Matches</h2>
              <span className="text-xs text-muted-foreground">{recent.length} games</span>
              {uniqueCompetitions.length > 1 && (
                <div className="ml-2 flex flex-wrap gap-1.5">
                  {uniqueCompetitions.map(c => {
                    const cs = compStyle(c);
                    return (
                      <span key={c} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cs.bg} ${cs.text} ${cs.ring}`}>
                        {c}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                      {showCompetitionCol && (
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Competition</th>
                      )}
                      <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Opponent</th>
                      <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Result</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {recent.map((m, i) => {
                      const won  = m.result?.toLowerCase().startsWith('w');
                      const lost = m.result?.toLowerCase().startsWith('l');
                      const drew = m.result?.toLowerCase().startsWith('d');
                      const cs = compStyle(m.competition);
                      const statEntries = Object.entries(m.stats)
                        .filter(([, v]) => v && v !== '0' && v !== '0.0')
                        .slice(0, 4);

                      return (
                        <tr key={i} className="hover:bg-muted/25 transition-colors">
                          {/* Date */}
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {m.date
                              ? new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </td>

                          {/* Competition */}
                          {showCompetitionCol && (
                            <td className="px-3 py-3">
                              {m.competition ? (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cs.bg} ${cs.text} ${cs.ring}`}>
                                  {m.competitionShort || m.competition}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </td>
                          )}

                          {/* Opponent */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground font-medium w-5 text-center">
                                {m.homeAway === 'away' ? '@' : 'vs'}
                              </span>
                              {m.opponent?.logo && (
                                <Image src={m.opponent.logo} alt="" width={18} height={18} className="h-4 w-4 object-contain shrink-0" unoptimized />
                              )}
                              <span className="text-xs font-medium text-foreground">
                                {m.opponent?.name || m.opponent?.abbr || '—'}
                              </span>
                            </div>
                          </td>

                          {/* Result */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full shrink-0 ${won ? 'bg-emerald-500' : lost ? 'bg-red-500' : drew ? 'bg-amber-400' : 'bg-muted-foreground'}`} />
                              <span className={`text-xs font-bold ${won ? 'text-emerald-600 dark:text-emerald-400' : lost ? 'text-red-600 dark:text-red-400' : drew ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                {m.result || '—'}
                              </span>
                              {m.score && (
                                <span className="text-[10px] text-muted-foreground">{m.score}</span>
                              )}
                            </div>
                          </td>

                          {/* Performance */}
                          <td className="px-4 py-3">
                            {statEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {statEntries.map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                                    {v} {k}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ── EMPTY STATE ─────────────────────────────────────── */}
        {statCategories.length === 0 && recent.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-3xl">📊</div>
            <p className="text-sm font-bold text-foreground">No stats available yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
              ESPN hasn&apos;t published season data for this player yet. Check back during the season.
            </p>
            <Link
              href="/matches"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition-colors"
            >
              Browse Matches
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
