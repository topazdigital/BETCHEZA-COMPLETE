import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, MapPin, Calendar, Ruler, Weight, Star, GitCompareArrows, Trophy } from 'lucide-react';
import { getSiteSettings } from '@/lib/site-settings';
import { extractNumericPlayerId } from '@/lib/utils/slug';
import { teamHref } from '@/lib/utils/slug';

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
  const description = `${player.name}${teamPart}${player.nationality ? ` — ${player.nationality}` : ''}. Stats, profile and recent matches.`;
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

// Pull a couple of headline stats out of the categories so the header card
// can show "12 goals · 5 assists" at a glance instead of forcing the user
// to scroll. We look across every category so this works for any sport
// (goals/assists for soccer, points/rebounds for basketball, etc).
function pickHeadlineStats(categories: StatCategory[]): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const headline: Array<{ label: string; value: string }> = [];
  const wanted = ['goals', 'assists', 'appearances', 'points', 'rebounds', 'wins', 'minutes'];
  for (const cat of categories) {
    for (const s of cat.stats || []) {
      const name = (s.name || s.displayName || '').toLowerCase();
      if (!name || seen.has(name)) continue;
      if (!wanted.some(w => name.includes(w))) continue;
      const value = s.displayValue ?? (s.value !== undefined ? String(s.value) : '');
      if (!value || value === '0' || value === '0.0') continue;
      headline.push({ label: s.displayName || s.name || name, value });
      seen.add(name);
      if (headline.length >= 4) return headline;
    }
  }
  return headline;
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const categories = extractStatCategories(player.stats);
  const headlineStats = pickHeadlineStats(categories);
  const recent = player.recentMatches || [];

  return (
    <div className="px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href="/matches"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to matches
        </Link>
        <Link
          href={`/players/compare?a=${encodeURIComponent(extractNumericPlayerId(String(player.id)) || player.id)}`}
          className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
        >
          <GitCompareArrows className="h-3 w-3" />
          Compare
        </Link>
      </div>

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
          {player.headshot ? (
            <div className="relative shrink-0">
              <Image
                src={player.headshot}
                alt={player.name}
                width={100}
                height={100}
                className="h-24 w-24 rounded-xl border border-border bg-muted object-cover sm:h-28 sm:w-28"
                unoptimized
              />
              {player.jersey && (
                <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
                  #{player.jersey}
                </span>
              )}
            </div>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-3xl font-bold text-primary sm:h-28 sm:w-28">
              {player.name.charAt(0)}
            </div>
          )}

          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {player.position && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {player.position}
                </span>
              )}
              {player.status && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {player.status}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {player.name}
            </h1>
            {player.team?.name && (
              player.team.id ? (
                <Link
                  href={teamHref(player.team.name, player.team.id)}
                  className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  {player.team.logo && (
                    <Image
                      src={player.team.logo}
                      alt={player.team.name}
                      width={16}
                      height={16}
                      className="h-4 w-4 object-contain"
                      unoptimized
                    />
                  )}
                  <span className="group-hover:underline">{player.team.name}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {player.team.logo && (
                    <Image
                      src={player.team.logo}
                      alt={player.team.name}
                      width={16}
                      height={16}
                      className="h-4 w-4 object-contain"
                      unoptimized
                    />
                  )}
                  <span>{player.team.name}</span>
                </div>
              )
            )}

            {/* Headline stats — surface 2-4 key numbers up top */}
            {headlineStats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {headlineStats.map((s, i) => (
                  <div key={i} className="rounded-lg border border-primary/30 bg-primary/5 px-2 py-1">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className="text-sm font-bold text-primary">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] sm:grid-cols-4">
              {player.age && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-2.5 w-2.5" /> Age
                  </div>
                  <div className="mt-0.5 font-semibold text-foreground">{player.age}</div>
                </div>
              )}
              {player.height && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Ruler className="h-2.5 w-2.5" /> Height
                  </div>
                  <div className="mt-0.5 font-semibold text-foreground">{player.height}</div>
                </div>
              )}
              {player.weight && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Weight className="h-2.5 w-2.5" /> Weight
                  </div>
                  <div className="mt-0.5 font-semibold text-foreground">{player.weight}</div>
                </div>
              )}
              {player.nationality && (
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" /> Nationality
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 font-semibold text-foreground">
                    {player.flag && (
                      <Image
                        src={player.flag}
                        alt={player.nationality}
                        width={14}
                        height={9}
                        className="rounded-sm object-cover"
                        unoptimized
                      />
                    )}
                    {player.nationality}
                  </div>
                </div>
              )}
            </div>
            {(player.birthPlace?.city || player.birthPlace?.country) && (
              <p className="pt-1 text-[10px] text-muted-foreground">
                Born in {[player.birthPlace.city, player.birthPlace.country].filter(Boolean).join(', ')}
                {player.dateOfBirth ? ` on ${new Date(player.dateOfBirth).toLocaleDateString()}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats — show every category ESPN gives us, not just the top 4. */}
      {categories.length > 0 && (
        <section className="mt-4 grid gap-3 md:grid-cols-2">
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
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {cat.displayName || cat.name || 'Stats'}
                </h2>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {rows.map((s, j) => (
                    <div key={j} className="flex justify-between gap-2 border-b border-border/50 pb-0.5">
                      <dt className="truncate text-muted-foreground">{s.displayName || s.name}</dt>
                      <dd className="font-semibold text-foreground">{s.displayValue ?? s.value ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </section>
      )}

      {/* Recent matches — gamelog, latest at top */}
      {recent.length > 0 && (
        <section className="mt-4 rounded-xl border border-border bg-card p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Trophy className="h-3 w-3" /> Recent matches
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-[11px]">
              <thead className="text-left text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/50">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Opponent</th>
                  <th className="py-1 pr-2">Result</th>
                  <th className="py-1">Stats</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m, i) => {
                  const statSummary = Object.entries(m.stats)
                    .filter(([, v]) => v && v !== '0' && v !== '0.0')
                    .slice(0, 3)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(' · ');
                  const won = m.result?.toLowerCase().includes('w');
                  const lost = m.result?.toLowerCase().includes('l');
                  return (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {m.date ? new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground">{m.homeAway === 'away' ? '@' : 'vs'}</span>
                          {m.opponent?.logo && (
                            <Image src={m.opponent.logo} alt="" width={12} height={12} className="object-contain" unoptimized />
                          )}
                          <span className="font-medium">{m.opponent?.abbr || m.opponent?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className={`inline-flex items-center gap-1 font-semibold ${won ? 'text-emerald-600' : lost ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {m.result || '—'}
                          {m.score && <span className="text-[9px] text-muted-foreground">{m.score}</span>}
                        </span>
                      </td>
                      <td className="py-1.5 text-muted-foreground">{statSummary || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {categories.length === 0 && recent.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
          Detailed stats for this player aren&apos;t available right now.
        </div>
      )}
    </div>
  );
}
