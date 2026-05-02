import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, MapPin, Calendar, Ruler, Weight, Trophy, GitCompareArrows, Briefcase, Star } from 'lucide-react';
import { getSiteSettings } from '@/lib/site-settings';
import { extractNumericPlayerId } from '@/lib/utils/slug';
import { teamHref } from '@/lib/utils/slug';
import { FollowPlayerButton } from '@/components/players/follow-player-button';

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
}

async function getPlayer(id: string): Promise<PlayerProfile | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
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
  if (!player) {
    return { title: `Player not found · ${settings.site_name}` };
  }
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

interface StatRow {
  name?: string;
  displayName?: string;
  displayValue?: string;
  value?: number;
}
interface StatCategory {
  name?: string;
  displayName?: string;
  stats?: StatRow[];
}
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
  const wanted = ['goals', 'assists', 'appearances', 'points', 'rebounds', 'wins', 'minutes', 'saves', 'tackles', 'passes'];
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

function getPositionColor(position?: string): string {
  const p = (position || '').toLowerCase();
  if (p.includes('goalkeeper') || p.includes('goalie') || p === 'gk') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
  if (p.includes('defender') || p.includes('back') || p === 'cb' || p === 'lb' || p === 'rb') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
  if (p.includes('midfield') || p === 'cm' || p === 'dm' || p === 'am') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p === 'st' || p === 'cf') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
  return 'bg-primary/10 text-primary border-primary/30';
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const numericId = extractNumericPlayerId(String(player.id)) || player.id;
  const categories = extractStatCategories(player.stats);
  const headlineStats = pickHeadlineStats(categories);
  const recent = player.recentMatches || [];

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 md:px-5">
      {/* Nav row */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/matches"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to matches
        </Link>
        <div className="flex items-center gap-2">
          <FollowPlayerButton
            playerId={numericId}
            playerName={player.name}
            playerHeadshot={player.headshot}
            teamId={player.team?.id}
            teamName={player.team?.name}
            teamLogo={player.team?.logo}
            sportSlug={player.sportPath?.split('/')[0]}
            variant="compact"
          />
          <Link
            href={`/players/compare?a=${encodeURIComponent(numericId)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
          >
            <GitCompareArrows className="h-3 w-3" />
            Compare
          </Link>
        </div>
      </div>

      {/* Hero card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-background to-muted/30">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          {/* Avatar + jersey */}
          <div className="relative shrink-0">
            {player.headshot ? (
              <Image
                src={player.headshot}
                alt={player.name}
                width={120}
                height={120}
                className="h-28 w-28 rounded-2xl border border-border bg-muted object-cover shadow-md sm:h-32 sm:w-32"
                unoptimized
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-4xl font-bold text-primary shadow-md sm:h-32 sm:w-32">
                {player.name.charAt(0)}
              </div>
            )}
            {player.jersey && (
              <span className="absolute -bottom-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground shadow-lg">
                #{player.jersey}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {player.position && (
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getPositionColor(player.position)}`}>
                  {player.position}
                </span>
              )}
              {player.status && player.status.toLowerCase() !== 'active' && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  {player.status}
                </span>
              )}
              {player.experienceYears !== undefined && player.experienceYears > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {player.experienceYears}y exp
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {player.name}
            </h1>

            {player.team?.name && (
              <div className="flex items-center gap-2">
                {player.team.id ? (
                  <Link
                    href={teamHref(player.team.name, player.team.id)}
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    {player.team.logo && (
                      <Image src={player.team.logo} alt={player.team.name} width={18} height={18} className="h-4 w-4 object-contain" unoptimized />
                    )}
                    <span>{player.team.name}</span>
                  </Link>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    {player.team.logo && (
                      <Image src={player.team.logo} alt={player.team.name} width={16} height={16} className="h-4 w-4 object-contain" unoptimized />
                    )}
                    {player.team.name}
                  </div>
                )}
              </div>
            )}

            {/* Headline stats */}
            {headlineStats.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {headlineStats.map((s, i) => (
                  <div key={i} className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
                    <div className="text-base font-bold text-primary leading-tight">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Bio grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] sm:grid-cols-4">
              {player.age && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                    <Calendar className="h-2.5 w-2.5" /> Age
                  </div>
                  <div className="font-semibold text-foreground">{player.age}</div>
                </div>
              )}
              {player.height && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                    <Ruler className="h-2.5 w-2.5" /> Height
                  </div>
                  <div className="font-semibold text-foreground">{player.height}</div>
                </div>
              )}
              {player.weight && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                    <Weight className="h-2.5 w-2.5" /> Weight
                  </div>
                  <div className="font-semibold text-foreground">{player.weight}</div>
                </div>
              )}
              {player.nationality && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                    <MapPin className="h-2.5 w-2.5" /> Nationality
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    {player.flag && (
                      <Image src={player.flag} alt={player.nationality} width={14} height={9} className="rounded-sm object-cover" unoptimized />
                    )}
                    {player.nationality}
                  </div>
                </div>
              )}
            </div>

            {/* Birthplace */}
            {(player.birthPlace?.city || player.birthPlace?.country) && (
              <p className="pt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                Born in {[player.birthPlace.city, player.birthPlace.country].filter(Boolean).join(', ')}
                {player.dateOfBirth ? ` — ${new Date(player.dateOfBirth).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Follow CTA banner — only shown if team is known */}
        {player.team?.name && (
          <div className="border-t border-border/50 bg-muted/20 px-5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              <span>Follow to get match alerts when {player.name} plays</span>
            </div>
            <FollowPlayerButton
              playerId={numericId}
              playerName={player.name}
              playerHeadshot={player.headshot}
              teamId={player.team?.id}
              teamName={player.team?.name}
              teamLogo={player.team?.logo}
              sportSlug={player.sportPath?.split('/')[0]}
              variant="compact"
            />
          </div>
        )}
      </div>

      {/* Stats grid — show every category ESPN gives us */}
      {categories.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Season Statistics
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((cat, i) => {
              const rows = (cat.stats || []).filter(s =>
                (s.displayValue ?? s.value ?? '') !== '' &&
                (s.displayValue ?? s.value ?? '') !== '0' &&
                (s.displayValue ?? s.value ?? '') !== '0.0' &&
                (s.displayValue ?? s.value ?? '') !== '-'
              );
              if (rows.length === 0) return null;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {cat.displayName || cat.name || 'Stats'}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {rows.map((s, j) => (
                      <div key={j} className="flex justify-between gap-2 border-b border-border/40 pb-0.5 last:border-0">
                        <dt className="truncate text-muted-foreground">{s.displayName || s.name}</dt>
                        <dd className="font-bold text-foreground tabular-nums">{s.displayValue ?? s.value ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent matches */}
      {recent.length > 0 && (
        <section className="mt-5 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-bold">Recent Matches</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">Last {recent.length} games</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-[11px]">
              <thead className="text-left text-[9px] uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-2 py-2">Opponent</th>
                  <th className="px-2 py-2">Result</th>
                  <th className="px-4 py-2">Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recent.map((m, i) => {
                  const statSummary = Object.entries(m.stats)
                    .filter(([, v]) => v && v !== '0' && v !== '0.0')
                    .slice(0, 4)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(' · ');
                  const won = m.result?.toLowerCase().includes('w');
                  const lost = m.result?.toLowerCase().includes('l');
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {m.date ? new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground">{m.homeAway === 'away' ? '@' : 'vs'}</span>
                          {m.opponent?.logo && (
                            <Image src={m.opponent.logo} alt="" width={14} height={14} className="object-contain" unoptimized />
                          )}
                          <span className="font-medium">{m.opponent?.abbr || m.opponent?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1 font-bold ${won ? 'text-emerald-600' : lost ? 'text-red-600' : 'text-muted-foreground'}`}>
                          <span className={`inline-block h-2 w-2 rounded-full ${won ? 'bg-emerald-500' : lost ? 'bg-red-500' : 'bg-muted-foreground'}`} />
                          {m.result || '—'}
                          {m.score && <span className="text-[9px] text-muted-foreground font-normal ml-0.5">{m.score}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{statSummary || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {categories.length === 0 && recent.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm font-semibold">No detailed stats available yet</p>
          <p className="mt-1 text-xs text-muted-foreground">ESPN hasn't published season data for this player. Check back during the season.</p>
        </div>
      )}
    </div>
  );
}
