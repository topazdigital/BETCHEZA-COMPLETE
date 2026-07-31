import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  ChevronLeft, MapPin, Calendar, Ruler, Weight,
  Trophy, GitCompareArrows, Briefcase,
  TrendingUp, Activity, Shield, Zap, Target, Star,
  BarChart3, Hash, Clock,
} from 'lucide-react';
import { getSiteSettings } from '@/lib/site-settings';
import { extractNumericPlayerId } from '@/lib/utils/slug';
import { teamHref } from '@/lib/utils/slug';
import { FollowPlayerButton } from '@/components/players/follow-player-button';
import { PlayerHeroImage } from '@/components/players/player-hero-image';
import { cn } from '@/lib/utils';

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
  const sportName = getSportName(player.sportPath?.split('/')[0] || 'soccer');
  const title = `${player.name}${positionPart}${teamPart} · ${settings.site_name}`;
  const description = `${player.name} — ${sportName} ${player.position || 'player'}${teamPart}${player.nationality ? `, ${player.nationality}` : ''}. Season stats, recent matches and performance data on ${settings.site_name}.`;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: player.headshot ? [{ url: player.headshot }] : undefined,
      type: 'profile',
      url: `${baseUrl}/players/${id}`,
      siteName: settings.site_name,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${baseUrl}/players/${id}` },
  };
}

interface StatRow { name?: string; displayName?: string; displayValue?: string; value?: number }
interface StatCategory { name?: string; displayName?: string; stats?: StatRow[] }
interface AthleteStats {
  splits?: { categories?: StatCategory[] };
  categories?: StatCategory[];
}

function getSportName(sportRoot: string): string {
  const map: Record<string, string> = {
    soccer: 'Football', football: 'American Football', basketball: 'Basketball',
    baseball: 'Baseball', hockey: 'Ice Hockey', tennis: 'Tennis', cricket: 'Cricket',
    rugby: 'Rugby', mma: 'MMA', boxing: 'Boxing', volleyball: 'Volleyball',
  };
  return map[sportRoot] || sportRoot.charAt(0).toUpperCase() + sportRoot.slice(1);
}

function extractStatCategories(stats: unknown): StatCategory[] {
  if (!stats || typeof stats !== 'object') return [];
  const s = stats as AthleteStats;
  return s.splits?.categories || s.categories || [];
}

// Sport-specific headline stat priority
function pickHeadlineStats(categories: StatCategory[], sportRoot: string): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const headline: Array<{ label: string; value: string }> = [];

  const SPORT_WANTED: Record<string, string[]> = {
    soccer:     ['goals', 'assists', 'appearances', 'shots', 'passes', 'tackles', 'saves', 'rating', 'minutes'],
    basketball: ['points', 'rebounds', 'assists', 'blocks', 'steals', 'minutes', 'fieldgoal', 'three'],
    baseball:   ['average', 'homerun', 'rbi', 'hits', 'strikeout', 'era', 'wins', 'saves'],
    hockey:     ['goals', 'assists', 'points', 'plusminus', 'shots', 'saves', 'pim', 'games'],
    tennis:     ['wins', 'aces', 'doublefault', 'firstserve', 'breakpoint', 'titles'],
    football:   ['touchdowns', 'yards', 'completion', 'interception', 'sacks', 'tackles', 'carries'],
    cricket:    ['runs', 'average', 'wickets', 'economy', 'centuries', 'fifties', 'catches'],
    rugby:      ['tries', 'tackles', 'carries', 'points', 'kicks', 'passes', 'lineouts'],
  };

  const wanted = SPORT_WANTED[sportRoot] || ['goals', 'assists', 'appearances', 'points', 'wins', 'saves', 'rating'];

  for (const cat of categories) {
    for (const s of cat.stats || []) {
      const name = (s.name || s.displayName || '').toLowerCase().replace(/\s+/g, '');
      if (!name || seen.has(name)) continue;
      if (!wanted.some(w => name.includes(w))) continue;
      const value = s.displayValue ?? (s.value !== undefined ? String(s.value) : '');
      if (!value || value === '0' || value === '0.0' || value === '--') continue;
      headline.push({ label: s.displayName || s.name || name, value });
      seen.add(name);
      if (headline.length >= 6) return headline;
    }
  }
  return headline;
}

function getPositionStyle(position?: string): { badge: string; accent: string } {
  const p = (position || '').toLowerCase();
  if (p.includes('goalkeeper') || p.includes('goalie') || p === 'gk')
    return { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', accent: 'from-amber-600/20 via-amber-900/10' };
  if (p.includes('defender') || p.includes('back') || p === 'cb' || p === 'lb' || p === 'rb' || p === 'def')
    return { badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30', accent: 'from-sky-700/20 via-sky-900/10' };
  if (p.includes('midfield') || p === 'cm' || p === 'dm' || p === 'am' || p === 'mid')
    return { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', accent: 'from-emerald-700/20 via-emerald-900/10' };
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p === 'st' || p === 'cf' || p === 'fwd')
    return { badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30', accent: 'from-rose-700/20 via-rose-900/10' };
  if (p.includes('pitcher') || p.includes('quarterback') || p.includes('center') || p.includes('guard'))
    return { badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30', accent: 'from-violet-700/20 via-violet-900/10' };
  return { badge: 'bg-primary/20 text-primary border-primary/30', accent: 'from-primary/20 via-primary/5' };
}

const COMPETITION_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  'Premier League':   { bg: 'bg-purple-500/15', text: 'text-purple-400', ring: 'ring-purple-500/20' },
  'Champions League': { bg: 'bg-blue-500/15',   text: 'text-blue-400',   ring: 'ring-blue-500/20' },
  'Europa League':    { bg: 'bg-orange-500/15', text: 'text-orange-400', ring: 'ring-orange-500/20' },
  'La Liga':          { bg: 'bg-red-500/15',    text: 'text-red-400',    ring: 'ring-red-500/20' },
  'Serie A':          { bg: 'bg-blue-500/15',   text: 'text-blue-400',   ring: 'ring-blue-500/20' },
  'Bundesliga':       { bg: 'bg-yellow-500/15', text: 'text-yellow-400', ring: 'ring-yellow-500/20' },
  'NBA':              { bg: 'bg-red-500/15',    text: 'text-red-400',    ring: 'ring-red-500/20' },
  'NFL':              { bg: 'bg-blue-500/15',   text: 'text-blue-400',   ring: 'ring-blue-500/20' },
};
function compStyle(name?: string) {
  return COMPETITION_STYLES[name || ''] || { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border' };
}

function getCatIcon(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('offens') || n.includes('attack') || n.includes('goal') || n.includes('shot') || n.includes('scoring'))
    return <Target className="h-3.5 w-3.5" />;
  if (n.includes('defens') || n.includes('tackle') || n.includes('block'))
    return <Shield className="h-3.5 w-3.5" />;
  if (n.includes('pass') || n.includes('creat') || n.includes('assist'))
    return <Zap className="h-3.5 w-3.5" />;
  if (n.includes('pitch') || n.includes('throw'))
    return <TrendingUp className="h-3.5 w-3.5" />;
  if (n.includes('general') || n.includes('misc') || n.includes('disciplin') || n.includes('summary'))
    return <Activity className="h-3.5 w-3.5" />;
  return <BarChart3 className="h-3.5 w-3.5" />;
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const numericId = extractNumericPlayerId(String(player.id)) || player.id;
  const sportRoot = player.sportPath?.split('/')[0] || 'soccer';
  const sportName = getSportName(sportRoot);
  const categories = extractStatCategories(player.stats);
  const headlineStats = pickHeadlineStats(categories, sportRoot);
  const recent = player.recentMatches || [];
  const { badge: positionBadge, accent } = getPositionStyle(player.position);

  const statCategories = categories.map(cat => {
    const rows = (cat.stats || []).filter(s => {
      const v = s.displayValue ?? (s.value !== undefined ? String(s.value) : '');
      return v && v !== '0' && v !== '0.0' && v !== '-' && v !== '--' && v !== '';
    });
    return { ...cat, filteredStats: rows };
  }).filter(cat => cat.filteredStats.length > 0);

  const uniqueCompetitions = Array.from(new Set(recent.map(r => r.competition).filter(Boolean))) as string[];
  const showCompetitionCol = uniqueCompetitions.length > 1;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    url: `${baseUrl}/players/${id}`,
    ...(player.headshot ? { image: player.headshot } : {}),
    ...(player.nationality ? { nationality: player.nationality } : {}),
    ...(player.dateOfBirth ? { birthDate: player.dateOfBirth } : {}),
    ...(player.team?.name ? { memberOf: { '@type': 'SportsTeam', name: player.team.name } } : {}),
  };

  return (
    <div className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── COMPACT HERO ─────────────────────────────────────────── */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${accent} to-slate-950 dark:to-background`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_70%_50%,rgba(255,255,255,0.04),transparent)]" />

        {/* Blurred backdrop */}
        {player.headshot && (
          <div
            className="absolute inset-0 opacity-[0.05] scale-110"
            style={{ backgroundImage: `url(${player.headshot})`, backgroundSize: 'cover', backgroundPosition: 'center top', filter: 'blur(60px)' }}
          />
        )}

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6">
          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 pb-2">
            <Link
              href="/matches"
              className="inline-flex items-center gap-1 rounded-md bg-white/8 hover:bg-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/60 hover:text-white/90 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/players/compare?a=${encodeURIComponent(numericId)}`}
                className="inline-flex items-center gap-1 rounded-md bg-white/8 hover:bg-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/60 hover:text-white/80 transition-colors"
              >
                <GitCompareArrows className="h-3 w-3" />
                Compare
              </Link>
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
          </div>

          {/* Main hero row */}
          <div className="flex items-center gap-4 sm:gap-6 pb-5 pt-1">
            {/* Photo */}
            <div className="relative shrink-0">
              <PlayerHeroImage
                headshot={player.headshot}
                name={player.name}
                id={numericId}
                sport={sportRoot}
                size={160}
                className="h-24 w-20 sm:h-28 sm:w-24 rounded-xl object-cover object-top shadow-xl ring-2 ring-white/10"
                fallbackClassName="flex h-24 w-20 sm:h-28 sm:w-24 shrink-0 items-center justify-center rounded-xl bg-white/5 text-4xl font-black text-white/20 shadow-xl ring-2 ring-white/10"
              />
              {player.jersey && (
                <div className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white shadow-lg ring-2 ring-slate-950">
                  <Hash className="h-2.5 w-2.5 absolute opacity-50" style={{ top: '5px', left: '2px' }} />
                  <span className="relative">{player.jersey}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Name + sport label */}
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {player.position && (
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', positionBadge)}>
                      {player.position}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-white/8 border border-white/10 px-2 py-0.5 text-[10px] text-white/50">
                    {sportName}
                  </span>
                  {player.nationality && player.flag && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/10 px-2 py-0.5 text-[10px] text-white/60">
                      <Image src={player.flag} alt={player.nationality} width={12} height={8} className="rounded-sm" unoptimized />
                      {player.nationality}
                    </span>
                  )}
                  {player.status && player.status.toLowerCase() !== 'active' && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      {player.status}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]">
                  {player.name}
                </h1>
              </div>

              {/* Team link */}
              {player.team?.name && (
                <div>
                  {player.team.id ? (
                    <Link
                      href={teamHref(player.team.name, player.team.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-white/8 hover:bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/75 hover:text-white transition-colors ring-1 ring-white/10"
                    >
                      {player.team.logo && (
                        <Image src={player.team.logo} alt={player.team.name} width={16} height={16} className="h-4 w-4 object-contain" unoptimized />
                      )}
                      {player.team.name}
                    </Link>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/65 ring-1 ring-white/10">
                      {player.team.logo && (
                        <Image src={player.team.logo} alt={player.team.name} width={16} height={16} className="h-4 w-4 object-contain" unoptimized />
                      )}
                      {player.team.name}
                    </div>
                  )}
                </div>
              )}

              {/* Key info row: age, height, weight, experience */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                {player.age && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {player.age} yrs
                  </span>
                )}
                {player.height && (
                  <span className="inline-flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    {player.height}
                  </span>
                )}
                {player.weight && (
                  <span className="inline-flex items-center gap-1">
                    <Weight className="h-3 w-3" />
                    {player.weight}
                  </span>
                )}
                {player.experienceYears !== undefined && player.experienceYears > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {player.experienceYears}y pro
                  </span>
                )}
                {player.birthPlace?.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[player.birthPlace.city, player.birthPlace.country].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Headline stats strip ── */}
          {headlineStats.length > 0 && (
            <div className="flex gap-2 pb-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {headlineStats.map((s, i) => (
                <div key={i} className="shrink-0 rounded-xl bg-white/6 backdrop-blur-sm border border-white/8 px-4 py-2.5 text-center min-w-[72px] hover:bg-white/10 transition-colors">
                  <div className="text-lg sm:text-xl font-black text-white leading-none tabular-nums">{s.value}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-widest text-white/40 leading-none">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-7">

        {/* ── SEASON STATS ──────────────────────────────────────── */}
        {statCategories.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Season Statistics</h2>
              <span className="text-xs text-muted-foreground">— {sportName}</span>
              <div className="h-px flex-1 bg-border" />
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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {statCategories.map((cat, i) => {
                const numericStats = cat.filteredStats
                  .map(s => ({ ...s, numVal: parseFloat(s.displayValue || String(s.value ?? 0)) || 0 }));
                const maxVal = Math.max(...numericStats.map(s => s.numVal), 1);

                return (
                  <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3.5 py-2">
                      <span className="text-primary/60">{getCatIcon(cat.displayName || cat.name)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {cat.displayName || cat.name || 'Statistics'}
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {numericStats.map((s, j) => {
                        const pct = Math.min(100, (s.numVal / maxVal) * 100);
                        return (
                          <div key={j} className="flex items-center gap-3 px-3.5 py-2 hover:bg-muted/20 transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-muted-foreground truncate group-hover:text-foreground transition-colors">
                                {s.displayName || s.name}
                              </div>
                              <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/40 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-sm font-black tabular-nums text-foreground shrink-0 min-w-[38px] text-right">
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
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Recent Matches</h2>
              <span className="text-xs text-muted-foreground">{recent.length} games</span>
              {uniqueCompetitions.length > 1 && (
                <div className="ml-1 flex flex-wrap gap-1">
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

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                      {showCompetitionCol && (
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Comp</th>
                      )}
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Opponent</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Result</th>
                      <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance</th>
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
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3.5 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                            {m.date
                              ? new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                              : '—'}
                          </td>

                          {showCompetitionCol && (
                            <td className="px-3 py-2.5">
                              {m.competition ? (
                                <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1', cs.bg, cs.text, cs.ring)}>
                                  {m.competitionShort || m.competition.split(' ').slice(0, 2).join(' ')}
                                </span>
                              ) : <span className="text-xs text-muted-foreground/30">—</span>}
                            </td>
                          )}

                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground w-4 text-center shrink-0">
                                {m.homeAway === 'away' ? '@' : 'vs'}
                              </span>
                              {m.opponent?.logo && (
                                <Image src={m.opponent.logo} alt="" width={16} height={16} className="h-4 w-4 object-contain shrink-0" unoptimized />
                              )}
                              <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
                                {m.opponent?.abbr || m.opponent?.name || '—'}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', won ? 'bg-emerald-500' : lost ? 'bg-red-500' : drew ? 'bg-amber-400' : 'bg-muted-foreground')} />
                              <span className={cn('text-[11px] font-bold', won ? 'text-emerald-500' : lost ? 'text-red-500' : drew ? 'text-amber-500' : 'text-muted-foreground')}>
                                {m.result || '—'}
                              </span>
                              {m.score && (
                                <span className="text-[10px] text-muted-foreground">{m.score}</span>
                              )}
                            </div>
                          </td>

                          <td className="px-3.5 py-2.5">
                            {statEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {statEntries.map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/75">
                                    {v} {k}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/30">—</span>
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
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-2xl">
              {sportRoot === 'basketball' ? '🏀' : sportRoot === 'tennis' ? '🎾' : sportRoot === 'baseball' ? '⚾' : sportRoot === 'hockey' ? '🏒' : sportRoot === 'cricket' ? '🏏' : '📊'}
            </div>
            <p className="text-sm font-bold text-foreground">No {sportName} stats available yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
              Season data for this player hasn&apos;t been published yet. Check back during the season.
            </p>
            <Link
              href="/matches"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition-colors"
            >
              <Star className="h-3.5 w-3.5" />
              Browse Matches
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
