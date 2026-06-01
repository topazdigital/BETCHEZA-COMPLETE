import { ImageResponse } from 'next/og';

export const alt = 'Match Preview — Betcheza';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
const BASE_URL = process.env.INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

interface SportTheme {
  emoji: string;
  primary: string;
  secondary: string;
  glow: string;
  label: string;
}

const SPORT_THEMES: Record<string, SportTheme> = {
  soccer:              { emoji: '⚽', primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22,163,74,0.35)',  label: 'Football' },
  football:            { emoji: '⚽', primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22,163,74,0.35)',  label: 'Football' },
  futsal:              { emoji: '⚽', primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22,163,74,0.35)',  label: 'Futsal' },
  tennis:              { emoji: '🎾', primary: '#ca8a04', secondary: '#a16207', glow: 'rgba(202,138,4,0.35)',  label: 'Tennis' },
  squash:              { emoji: '🎾', primary: '#ca8a04', secondary: '#a16207', glow: 'rgba(202,138,4,0.35)',  label: 'Squash' },
  'table-tennis':      { emoji: '🏓', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)',  label: 'Table Tennis' },
  basketball:          { emoji: '🏀', primary: '#ea580c', secondary: '#c2410c', glow: 'rgba(234,88,12,0.35)',  label: 'Basketball' },
  cricket:             { emoji: '🏏', primary: '#2563eb', secondary: '#1d4ed8', glow: 'rgba(37,99,235,0.35)',  label: 'Cricket' },
  rugby:               { emoji: '🏉', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)',  label: 'Rugby' },
  'aussie-rules':      { emoji: '🏉', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)',  label: 'Aussie Rules' },
  lacrosse:            { emoji: '🥍', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)',  label: 'Lacrosse' },
  'american-football': { emoji: '🏈', primary: '#b45309', secondary: '#92400e', glow: 'rgba(180,83,9,0.35)',   label: 'Am. Football' },
  baseball:            { emoji: '⚾', primary: '#1d4ed8', secondary: '#1e40af', glow: 'rgba(29,78,216,0.35)',  label: 'Baseball' },
  hockey:              { emoji: '🏒', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)',  label: 'Ice Hockey' },
  'ice-hockey':        { emoji: '🏒', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)',  label: 'Ice Hockey' },
  'field-hockey':      { emoji: '🏑', primary: '#059669', secondary: '#047857', glow: 'rgba(5,150,105,0.35)',  label: 'Field Hockey' },
  golf:                { emoji: '⛳', primary: '#15803d', secondary: '#166534', glow: 'rgba(21,128,61,0.35)',   label: 'Golf' },
  mma:                 { emoji: '🥊', primary: '#9333ea', secondary: '#7e22ce', glow: 'rgba(147,51,234,0.35)', label: 'MMA' },
  boxing:              { emoji: '🥊', primary: '#9333ea', secondary: '#7e22ce', glow: 'rgba(147,51,234,0.35)', label: 'Boxing' },
  wrestling:           { emoji: '🤼', primary: '#9333ea', secondary: '#7e22ce', glow: 'rgba(147,51,234,0.35)', label: 'Wrestling' },
  volleyball:          { emoji: '🏐', primary: '#0891b2', secondary: '#0e7490', glow: 'rgba(8,145,178,0.35)',  label: 'Volleyball' },
  'beach-volleyball':  { emoji: '🏐', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)',  label: 'Beach Volleyball' },
  handball:            { emoji: '🤾', primary: '#0891b2', secondary: '#0e7490', glow: 'rgba(8,145,178,0.35)',  label: 'Handball' },
  'water-polo':        { emoji: '🤽', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)',  label: 'Water Polo' },
  snooker:             { emoji: '🎱', primary: '#166534', secondary: '#14532d', glow: 'rgba(22,101,52,0.35)',   label: 'Snooker' },
  darts:               { emoji: '🎯', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)',  label: 'Darts' },
  badminton:           { emoji: '🏸', primary: '#7c3aed', secondary: '#6d28d9', glow: 'rgba(124,58,237,0.35)', label: 'Badminton' },
  cycling:             { emoji: '🚴', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)',  label: 'Cycling' },
  athletics:           { emoji: '🏃', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)',  label: 'Athletics' },
  swimming:            { emoji: '🏊', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)',  label: 'Swimming' },
  'formula-1':         { emoji: '🏎️', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)', label: 'Formula 1' },
  racing:              { emoji: '🏎️', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)', label: 'Racing' },
  motogp:              { emoji: '🏍️', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)', label: 'MotoGP' },
  nascar:              { emoji: '🏁',  primary: '#1f2937', secondary: '#111827', glow: 'rgba(31,41,55,0.5)',   label: 'NASCAR' },
  'horse-racing':      { emoji: '🐎', primary: '#92400e', secondary: '#78350f', glow: 'rgba(146,64,14,0.35)',  label: 'Horse Racing' },
  esports:             { emoji: '🎮', primary: '#7c3aed', secondary: '#6d28d9', glow: 'rgba(124,58,237,0.35)', label: 'Esports' },
  chess:               { emoji: '♟️', primary: '#374151', secondary: '#1f2937', glow: 'rgba(55,65,81,0.5)',    label: 'Chess' },
  'ski-jumping':       { emoji: '⛷️', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)', label: 'Ski Jumping' },
};

const DEFAULT_THEME: SportTheme = {
  emoji: '🏆', primary: '#10b981', secondary: '#059669', glow: 'rgba(16,185,129,0.35)', label: 'Sport',
};

function getTheme(sportSlug?: string): SportTheme {
  if (!sportSlug) return DEFAULT_THEME;
  return SPORT_THEMES[sportSlug.toLowerCase()] ?? DEFAULT_THEME;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

interface MatchData {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  league?: { name?: string; country?: string };
  kickoffTime?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  sport?: { slug?: string; name?: string };
}

async function fetchMatchForOg(id: string): Promise<MatchData | null> {
  try {
    const r = await fetch(`${BASE_URL}/api/matches/${encodeURIComponent(id)}/details`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const data = await r.json() as { match?: MatchData };
    return data.match ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await fetchMatchForOg(id);

  const sportSlug = match?.sport?.slug;
  const theme = getTheme(sportSlug);

  const home = match?.homeTeam?.name ?? '';
  const away = match?.awayTeam?.name ?? '';
  const league = match?.league?.name ?? '';
  const status = (match?.status ?? '').toLowerCase();

  const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen', 'walkover', 'awarded'].includes(status);
  const isLive = ['live', 'inprogress', 'in_progress', 'halftime', 'extra_time', 'penalties', 'break', 'ht'].includes(status);

  const homeScore = match?.homeScore ?? null;
  const awayScore = match?.awayScore ?? null;
  const hasScore = isLive || isFinished;

  let statusLabel = '';
  let statusColor = '';
  if (isLive) { statusLabel = '● LIVE'; statusColor = '#ef4444'; }
  else if (isFinished) { statusLabel = 'FULL TIME'; statusColor = '#94a3b8'; }
  else if (match?.kickoffTime) {
    try {
      const d = new Date(match.kickoffTime);
      statusLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      statusColor = '#94a3b8';
    } catch { statusLabel = ''; }
  }

  const homeDisplay = home ? truncate(home, 22) : 'Home Team';
  const awayDisplay = away ? truncate(away, 22) : 'Away Team';
  const leagueDisplay = league ? truncate(league, 40) : theme.label;

  const teamFontSize = (homeDisplay.length > 14 || awayDisplay.length > 14) ? 52 : 62;

  return new ImageResponse(
    (
      <div
        style={{
          background: `linear-gradient(135deg, #0a0f1a 0%, #0f172a 55%, #0a0f1a 100%)`,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Sport-coloured top bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
          display: 'flex',
        }} />

        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: -80, left: '50%',
          transform: 'translateX(-50%)',
          width: 700, height: 500,
          background: `radial-gradient(ellipse, ${theme.glow} 0%, transparent 65%)`,
          display: 'flex',
        }} />

        {/* Giant sport emoji watermark — right side */}
        <div style={{
          position: 'absolute',
          right: -20, bottom: -10,
          fontSize: 320,
          opacity: 0.07,
          display: 'flex',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          {theme.emoji}
        </div>

        {/* Dot grid */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          display: 'flex',
        }} />

        {/* ── Top bar: Betcheza + sport badge ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '36px 52px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: `0 0 20px ${theme.glow}`,
            }}>
              {theme.emoji}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ color: theme.primary, fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>Bet</span>
              <span style={{ color: '#ffffff', fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>cheza</span>
            </div>
          </div>

          {/* Sport badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: `rgba(255,255,255,0.06)`,
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 999,
            padding: '8px 18px',
          }}>
            <span style={{ fontSize: 18 }}>{theme.emoji}</span>
            <span style={{ color: '#cbd5e1', fontSize: 16, fontWeight: 600, letterSpacing: '0.5px' }}>
              {leagueDisplay}
            </span>
          </div>
        </div>

        {/* ── Centre: Teams + Score ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 52px',
          gap: 0,
        }}>
          {/* Home team */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            gap: 8,
          }}>
            <div style={{
              fontSize: teamFontSize,
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              letterSpacing: '-1px',
              lineHeight: 1.1,
              display: 'flex',
            }}>
              {homeDisplay}
            </div>
          </div>

          {/* Score / VS divider */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 32px',
            gap: 10,
            minWidth: 160,
          }}>
            {hasScore && homeScore !== null && awayScore !== null ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-2px',
                  lineHeight: 1,
                  display: 'flex',
                }}>
                  {homeScore}
                </span>
                <span style={{
                  fontSize: 48,
                  fontWeight: 400,
                  color: '#475569',
                  display: 'flex',
                }}>—</span>
                <span style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-2px',
                  lineHeight: 1,
                  display: 'flex',
                }}>
                  {awayScore}
                </span>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 72, height: 72,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${theme.primary}33, ${theme.secondary}22)`,
                border: `2px solid ${theme.primary}55`,
              }}>
                <span style={{ color: theme.primary, fontSize: 26, fontWeight: 800, display: 'flex' }}>VS</span>
              </div>
            )}

            {/* Status */}
            {statusLabel && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                border: isLive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 999,
                padding: '5px 14px',
              }}>
                <span style={{
                  color: statusColor,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: isLive ? '1px' : '0.5px',
                  display: 'flex',
                }}>
                  {statusLabel}
                </span>
              </div>
            )}
          </div>

          {/* Away team */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            gap: 8,
          }}>
            <div style={{
              fontSize: teamFontSize,
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              letterSpacing: '-1px',
              lineHeight: 1.1,
              display: 'flex',
            }}>
              {awayDisplay}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 52px 32px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 3, height: 18,
              background: `linear-gradient(to bottom, ${theme.primary}, ${theme.secondary})`,
              borderRadius: 2,
              display: 'flex',
            }} />
            <span style={{ color: '#64748b', fontSize: 16, fontWeight: 500, display: 'flex' }}>
              AI Predictions · Expert Tips · Live Odds
            </span>
          </div>
          <span style={{ color: '#334155', fontSize: 16, fontWeight: 500, display: 'flex' }}>
            betcheza.co.ke
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
