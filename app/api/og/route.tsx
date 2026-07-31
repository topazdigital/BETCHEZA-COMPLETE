import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

interface SportTheme {
  emoji: string;
  primary: string;
  secondary: string;
  glow: string;
}

const SPORT_THEMES: Record<string, SportTheme> = {
  soccer:              { emoji: '⚽', primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22,163,74,0.35)' },
  football:            { emoji: '⚽', primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22,163,74,0.35)' },
  futsal:              { emoji: '⚽', primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22,163,74,0.35)' },
  tennis:              { emoji: '🎾', primary: '#ca8a04', secondary: '#a16207', glow: 'rgba(202,138,4,0.35)' },
  squash:              { emoji: '🎾', primary: '#ca8a04', secondary: '#a16207', glow: 'rgba(202,138,4,0.35)' },
  'table-tennis':      { emoji: '🏓', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)' },
  basketball:          { emoji: '🏀', primary: '#ea580c', secondary: '#c2410c', glow: 'rgba(234,88,12,0.35)' },
  cricket:             { emoji: '🏏', primary: '#2563eb', secondary: '#1d4ed8', glow: 'rgba(37,99,235,0.35)' },
  rugby:               { emoji: '🏉', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)' },
  'aussie-rules':      { emoji: '🏉', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)' },
  lacrosse:            { emoji: '🥍', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)' },
  'american-football': { emoji: '🏈', primary: '#b45309', secondary: '#92400e', glow: 'rgba(180,83,9,0.35)' },
  baseball:            { emoji: '⚾', primary: '#1d4ed8', secondary: '#1e40af', glow: 'rgba(29,78,216,0.35)' },
  hockey:              { emoji: '🏒', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)' },
  'ice-hockey':        { emoji: '🏒', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)' },
  'field-hockey':      { emoji: '🏑', primary: '#059669', secondary: '#047857', glow: 'rgba(5,150,105,0.35)' },
  golf:                { emoji: '⛳', primary: '#15803d', secondary: '#166534', glow: 'rgba(21,128,61,0.35)' },
  mma:                 { emoji: '🥊', primary: '#9333ea', secondary: '#7e22ce', glow: 'rgba(147,51,234,0.35)' },
  boxing:              { emoji: '🥊', primary: '#9333ea', secondary: '#7e22ce', glow: 'rgba(147,51,234,0.35)' },
  wrestling:           { emoji: '🤼', primary: '#9333ea', secondary: '#7e22ce', glow: 'rgba(147,51,234,0.35)' },
  volleyball:          { emoji: '🏐', primary: '#0891b2', secondary: '#0e7490', glow: 'rgba(8,145,178,0.35)' },
  'beach-volleyball':  { emoji: '🏐', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)' },
  handball:            { emoji: '🤾', primary: '#0891b2', secondary: '#0e7490', glow: 'rgba(8,145,178,0.35)' },
  'water-polo':        { emoji: '🤽', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)' },
  snooker:             { emoji: '🎱', primary: '#166534', secondary: '#14532d', glow: 'rgba(22,101,52,0.35)' },
  darts:               { emoji: '🎯', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)' },
  badminton:           { emoji: '🏸', primary: '#7c3aed', secondary: '#6d28d9', glow: 'rgba(124,58,237,0.35)' },
  cycling:             { emoji: '🚴', primary: '#d97706', secondary: '#b45309', glow: 'rgba(217,119,6,0.35)' },
  athletics:           { emoji: '🏃', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)' },
  swimming:            { emoji: '🏊', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)' },
  'formula-1':         { emoji: '🏎️', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)' },
  racing:              { emoji: '🏎️', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)' },
  motogp:              { emoji: '🏍️', primary: '#dc2626', secondary: '#b91c1c', glow: 'rgba(220,38,38,0.35)' },
  nascar:              { emoji: '🏁',  primary: '#374151', secondary: '#1f2937', glow: 'rgba(100,116,139,0.4)' },
  'horse-racing':      { emoji: '🐎', primary: '#92400e', secondary: '#78350f', glow: 'rgba(146,64,14,0.35)' },
  esports:             { emoji: '🎮', primary: '#7c3aed', secondary: '#6d28d9', glow: 'rgba(124,58,237,0.35)' },
  chess:               { emoji: '♟️', primary: '#475569', secondary: '#334155', glow: 'rgba(71,85,105,0.5)' },
  'ski-jumping':       { emoji: '⛷️', primary: '#0284c7', secondary: '#0369a1', glow: 'rgba(2,132,199,0.35)' },
};

const DEFAULT_THEME: SportTheme = {
  emoji: '🏆', primary: '#10b981', secondary: '#059669', glow: 'rgba(16,185,129,0.35)',
};

function getTheme(slug?: string | null): SportTheme {
  if (!slug) return DEFAULT_THEME;
  return SPORT_THEMES[slug.toLowerCase()] ?? DEFAULT_THEME;
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

interface MatchData {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  league?: { name?: string };
  kickoffTime?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  sport?: { slug?: string };
}

async function fetchMatch(id: string): Promise<MatchData | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/matches/${encodeURIComponent(id)}/details`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { match?: MatchData };
    return data.match ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id') ?? '';
  const sportSlug = searchParams.get('sport') ?? '';
  const homeParam = searchParams.get('home') ?? '';
  const awayParam = searchParams.get('away') ?? '';
  const leagueParam = searchParams.get('league') ?? '';

  let home = homeParam;
  let away = awayParam;
  let league = leagueParam;
  let status = searchParams.get('status') ?? '';
  let homeScore: number | null = searchParams.has('hs') ? Number(searchParams.get('hs')) : null;
  let awayScore: number | null = searchParams.has('as') ? Number(searchParams.get('as')) : null;
  let resolvedSportSlug = sportSlug;
  let kickoffTime = searchParams.get('kickoff') ?? '';

  // If id provided and any required field is missing, fetch from API
  if (id && (!home || !away)) {
    const match = await fetchMatch(id);
    if (match) {
      home = match.homeTeam?.name ?? home;
      away = match.awayTeam?.name ?? away;
      league = match.league?.name ?? league;
      status = match.status ?? status;
      homeScore = match.homeScore ?? homeScore;
      awayScore = match.awayScore ?? awayScore;
      resolvedSportSlug = match.sport?.slug ?? resolvedSportSlug;
      kickoffTime = match.kickoffTime ?? kickoffTime;
    }
  }

  const theme = getTheme(resolvedSportSlug || null);

  const s = status.toLowerCase();
  const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen', 'walkover', 'awarded'].includes(s);
  const isLive = ['live', 'inprogress', 'in_progress', 'halftime', 'extra_time', 'penalties', 'break', 'ht'].includes(s);
  const hasScore = (isLive || isFinished) && homeScore !== null && awayScore !== null;

  let statusLabel = '';
  let statusColor = '';
  if (isLive) { statusLabel = '● LIVE'; statusColor = '#ef4444'; }
  else if (isFinished) { statusLabel = 'FULL TIME'; statusColor = '#94a3b8'; }
  else if (kickoffTime) {
    try {
      statusLabel = new Date(kickoffTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      statusColor = '#94a3b8';
    } catch { /* ignore */ }
  }

  const homeDisplay = home ? trunc(home, 22) : 'Home Team';
  const awayDisplay = away ? trunc(away, 22) : 'Away Team';
  const leagueDisplay = league ? trunc(league, 44) : '';

  const teamFontSize = (homeDisplay.length > 14 || awayDisplay.length > 14) ? 50 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 55%, #0a0f1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Sport-coloured top accent bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 6,
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

        {/* Giant sport emoji watermark */}
        <div style={{
          position: 'absolute',
          right: -20, bottom: -10,
          fontSize: 320,
          opacity: 0.07,
          display: 'flex',
          lineHeight: 1,
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

        {/* Top bar: Betcheza logo + league badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '36px 52px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              boxShadow: `0 0 20px ${theme.glow}`,
            }}>
              {theme.emoji}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ color: theme.primary, fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px' }}>Bet</span>
              <span style={{ color: '#ffffff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px' }}>cheza</span>
            </div>
          </div>

          {leagueDisplay ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999,
              padding: '7px 16px',
            }}>
              <span style={{ fontSize: 16 }}>{theme.emoji}</span>
              <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600 }}>{leagueDisplay}</span>
            </div>
          ) : null}
        </div>

        {/* Centre: Teams + Score */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 52px',
        }}>
          {/* Home */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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

          {/* Divider / Score */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 28px',
            gap: 12,
            minWidth: 170,
          }}>
            {hasScore ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 80, fontWeight: 900, color: '#ffffff', letterSpacing: '-2px', lineHeight: 1, display: 'flex' }}>{homeScore}</span>
                <span style={{ fontSize: 44, fontWeight: 300, color: '#475569', display: 'flex' }}>—</span>
                <span style={{ fontSize: 80, fontWeight: 900, color: '#ffffff', letterSpacing: '-2px', lineHeight: 1, display: 'flex' }}>{awayScore}</span>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 68, height: 68,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${theme.primary}33, ${theme.secondary}22)`,
                border: `2px solid ${theme.primary}55`,
              }}>
                <span style={{ color: theme.primary, fontSize: 24, fontWeight: 800, display: 'flex' }}>VS</span>
              </div>
            )}

            {statusLabel ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                border: isLive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 999,
                padding: '5px 14px',
              }}>
                <span style={{ color: statusColor, fontSize: 13, fontWeight: 700, letterSpacing: '1px', display: 'flex' }}>
                  {statusLabel}
                </span>
              </div>
            ) : null}
          </div>

          {/* Away */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 52px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 3, height: 16, background: `linear-gradient(to bottom, ${theme.primary}, ${theme.secondary})`, borderRadius: 2, display: 'flex' }} />
            <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500, display: 'flex' }}>AI Predictions · Expert Tips · Live Odds</span>
          </div>
          <span style={{ color: '#334155', fontSize: 15, fontWeight: 500, display: 'flex' }}>betcheza.co.ke</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
