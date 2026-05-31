import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { query } from '@/lib/db';
import {
  listAllAutoTips,
  getAutoTipsStats,
  settleStaleAutoTips,
} from '@/lib/auto-tips-store';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { matchToSlug } from '@/lib/utils/match-url';

export const dynamic = 'force-dynamic';

function timeAgo(iso: string | Date): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(t).toLocaleDateString();
}

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, 'admin.access')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Settle stale auto-tips so KPI numbers aren't 100% pending.
  settleStaleAutoTips();

  const fakes = getFakeTipsters();

  // Real user count from DB
  let realUserCount = 0;
  let recentRealUsers: Array<{ id: number; name: string; email: string; avatar: string; joined: string; joinedAt: string; status: string; role: string; isFake: boolean }> = [];
  try {
    const countRow = await query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users');
    realUserCount = countRow.rows[0]?.cnt ?? 0;
    const recentRows = await query<{ id: number; display_name: string; username: string; email: string; avatar_url: string | null; role: string; is_verified: number; created_at: string }>(
      'SELECT id, display_name, username, email, avatar_url, role, is_verified, created_at FROM users ORDER BY created_at DESC LIMIT 8'
    );
    recentRealUsers = recentRows.rows.map(u => ({
      id: u.id,
      name: u.display_name || u.username || u.email,
      email: u.email,
      avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
      joined: timeAgo(u.created_at),
      joinedAt: new Date(u.created_at).toISOString(),
      status: u.is_verified ? 'active' : 'pending',
      role: u.role,
      isFake: false,
    }));
  } catch (e) {
    console.error('[admin/dashboard] DB user query failed:', e);
  }

  // ── Today's matches ────────────────────────────────────────────────
  const now = Date.now();
  const dayMs = 24 * 3600_000;
  let todayCount = 0;
  let upcomingCount = 0;
  let liveCount = 0;
  try {
    const matches = await getAllMatches();
    for (const m of matches) {
      const t = m.kickoffTime instanceof Date ? m.kickoffTime.getTime() : new Date(m.kickoffTime).getTime();
      if (Number.isFinite(t)) {
        if (Math.abs(t - now) < dayMs) todayCount++;
        if (t > now && t < now + 3 * dayMs) upcomingCount++;
      }
      if (m.status === 'live') liveCount++;
    }
  } catch { /* ignore */ }

  const tipsStats = getAutoTipsStats();
  const totalUsers = realUserCount + fakes.length;

  const stats = [
    {
      title: 'Total Users',
      value: totalUsers.toLocaleString(),
      change: `+${realUserCount} real`,
      trend: 'up' as const,
      icon: 'users',
    },
    {
      title: 'Active Tipsters',
      value: fakes.length.toLocaleString(),
      change: `${fakes.filter(t => t.isPro).length} pro`,
      trend: 'up' as const,
      icon: 'trophy',
    },
    {
      title: "Today's Matches",
      value: todayCount.toLocaleString(),
      change: `${liveCount} live`,
      trend: liveCount > 0 ? ('up' as const) : ('down' as const),
      icon: 'calendar',
    },
    {
      title: 'Predictions',
      value: tipsStats.total.toLocaleString(),
      change: `${tipsStats.pending} pending`,
      trend: 'up' as const,
      icon: 'trending',
    },
    {
      title: 'Win Rate',
      value: tipsStats.total > 0
        ? `${Math.round((tipsStats.won / Math.max(1, tipsStats.won + tipsStats.lost)) * 100)}%`
        : '—',
      change: `${tipsStats.won}W / ${tipsStats.lost}L`,
      trend: 'up' as const,
      icon: 'target',
    },
    {
      title: 'Coverage',
      value: tipsStats.matches.toLocaleString(),
      change: `${tipsStats.tipsters} tipsters`,
      trend: 'up' as const,
      icon: 'eye',
    },
  ];

  // ── Recent users (mix of real + fake, newest first) ────────────────
  const fakeRows = fakes.slice(0, 25).map(t => ({
    id: t.id,
    name: t.displayName,
    email: `${t.username}@tipsters.local`,
    avatar: t.avatar,
    joined: timeAgo(t.joinedAt),
    joinedAt: t.joinedAt,
    status: 'active',
    role: 'tipster',
    isFake: true as const,
  }));
  const recentUsers = [...recentRealUsers, ...fakeRows]
    .sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1))
    .slice(0, 8);

  // ── Recent predictions (auto + user submitted) ─────────────────────
  const recent = listAllAutoTips(8);
  const recentPredictions = recent.map(t => {
    const tipster = fakes.find(f => f.id === t.tipsterId);
    return {
      id: t.id,
      tipster: tipster?.displayName || `Tipster ${t.tipsterId}`,
      tipsterId: t.tipsterId,
      match: `${t.homeTeam} vs ${t.awayTeam}`,
      matchId: matchToSlug(t.matchId, t.homeTeam, t.awayTeam),
      prediction: t.prediction,
      odds: t.odds.toFixed(2),
      status: t.status,
      createdAt: t.createdAt,
    };
  });

  // ── Top tipsters (by ROI, then win rate) ───────────────────────────
  const topTipsters = fakes
    .slice()
    .sort((a, b) => b.roi - a.roi || b.winRate - a.winRate)
    .slice(0, 5)
    .map((t, i) => ({
      rank: i + 1,
      id: t.id,
      name: t.displayName,
      username: t.username,
      avatar: t.avatar,
      winRate: Math.round(t.winRate),
      roi: t.roi,
      profit: `${t.roi > 0 ? '+' : ''}${t.roi}%`,
      predictions: t.totalTips,
    }));

  // ── Live activity (mix of recent tips + new users) ─────────────────
  const activity: Array<{ action: string; user: string; time: string; ts: number }> = [];
  for (const t of recent) {
    const tn = fakes.find(f => f.id === t.tipsterId)?.displayName || `Tipster ${t.tipsterId}`;
    activity.push({
      action: `Posted tip · ${t.prediction} @ ${t.odds.toFixed(2)}`,
      user: tn,
      time: timeAgo(t.createdAt),
      ts: new Date(t.createdAt).getTime(),
    });
  }
  for (const u of recentRealUsers.slice(0, 3)) {
    activity.push({
      action: 'New user joined',
      user: u.name,
      time: u.joined,
      ts: new Date(u.joinedAt).getTime(),
    });
  }
  activity.sort((a, b) => b.ts - a.ts);
  const liveActivity = activity.slice(0, 6);

  return NextResponse.json({
    stats,
    recentUsers,
    recentPredictions,
    topTipsters,
    liveActivity,
    counts: {
      totalUsers,
      realUsers: realUserCount,
      fakeTipsters: fakes.length,
      todayMatches: todayCount,
      upcomingMatches: upcomingCount,
      liveMatches: liveCount,
      ...tipsStats,
    },
  });
}
