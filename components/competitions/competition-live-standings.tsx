"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Trophy, Star, Flame, RefreshCw, Wifi } from "lucide-react"
import { FlagIcon } from "@/components/ui/flag-icon"
import { Badge } from "@/components/ui/badge"
import { tipsterHref } from "@/lib/utils/slug"
import { cn } from "@/lib/utils"

interface Participant {
  rank: number
  tipsterId: number
  username: string
  displayName: string
  avatar: string | null
  countryCode: string | null
  winRate: number
  roi: number
  tips: number
  won: number
  lost: number
  pending: number
  points: number
  streak: number
  isVerified: boolean
  isFake: boolean
  prizeEligible?: boolean
}

interface Props {
  slug: string
  initialParticipants: Participant[]
  currentUserId?: number | null
  isActive: boolean
  leagueName?: string | null
  sportFocus?: string | null
  matchKickoffFrom?: string | null
  matchKickoffTo?: string | null
  prizes?: Array<{ place: string; amount: number }>
  currency?: string
  minimumTips?: number
}

const POLL_INTERVAL_ACTIVE = 30_000
const POLL_INTERVAL_IDLE   = 120_000

function isMatchWindowActive(kickoffFrom?: string | null, kickoffTo?: string | null): boolean {
  if (!kickoffFrom || !kickoffTo) return true
  const now = Date.now()
  const from = new Date(kickoffFrom).getTime() - 30 * 60 * 1000
  const to   = new Date(kickoffTo).getTime()   + 3  * 60 * 60 * 1000
  return now >= from && now <= to
}

/** Build a rank→amount map by parsing prize place strings like "1st", "2nd", "4-10th" */
function buildPrizeByRank(prizes: Array<{ place: string; amount: number }>): Record<number, { amount: number; place: string }> {
  const map: Record<number, { amount: number; place: string }> = {}
  prizes.forEach((p, i) => {
    const m = p.place.match(/(\d+)(?:[-–](\d+))?/)
    if (m) {
      const start = parseInt(m[1], 10)
      const end   = m[2] ? parseInt(m[2], 10) : start
      for (let r = start; r <= end; r++) {
        map[r] = { amount: p.amount, place: p.place }
      }
    } else {
      // Non-numeric place (e.g. "🥇 1st") — assign by index position
      map[i + 1] = { amount: p.amount, place: p.place }
    }
  })
  return map
}

export function CompetitionLiveStandings({
  slug, initialParticipants, currentUserId, isActive,
  leagueName, sportFocus, matchKickoffFrom, matchKickoffTo,
  prizes, currency = 'KES', minimumTips = 1,
}: Props) {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null)
  const [refreshing, setRefreshing]     = useState(false)
  const [error, setError]               = useState(false)
  const timerRef                        = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLeaderboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch(`/api/competitions/${slug}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      const p: Participant[] = (data.competition?.participants ?? []).map((r: Participant) => r)
      setParticipants(p)
      setLastUpdated(new Date())
      setError(false)
    } catch {
      setError(true)
    } finally {
      if (manual) setRefreshing(false)
    }
  }, [slug])

  useEffect(() => {
    if (!isActive) return

    const scheduleNext = () => {
      const inWindow = isMatchWindowActive(matchKickoffFrom, matchKickoffTo)
      const interval = inWindow ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE
      timerRef.current = setTimeout(async () => {
        await fetchLeaderboard()
        scheduleNext()
      }, interval)
    }

    scheduleNext()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isActive, fetchLeaderboard, matchKickoffFrom, matchKickoffTo])

  const inWindow    = isMatchWindowActive(matchKickoffFrom, matchKickoffTo)
  const totalTips   = participants.reduce((s, p) => s + p.tips, 0)
  // Only show prize column once games have kicked off and actual results are coming in
  const hasResults  = participants.some(p => p.won > 0 || p.lost > 0)
  const hasPrizes   = prizes && prizes.length > 0 && hasResults
  const prizeByRank = hasPrizes ? buildPrizeByRank(prizes!) : {}

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
        <h2 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-warning" />
          {isActive ? 'Live Standings' : 'Final Standings'}
          {isActive && inWindow && (
            <span className="flex items-center gap-1 ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-normal text-emerald-500">Live</span>
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {participants.length.toLocaleString()} tipsters
          </span>
          {isActive && (
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={refreshing}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              title="Refresh standings"
            >
              <RefreshCw className={cn("h-2.5 w-2.5", refreshing && "animate-spin")} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Last updated + poll indicator */}
      {isActive && (
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1 text-[10px] border-b border-border/50",
          error ? "bg-rose-500/5 text-rose-400" : "bg-muted/10 text-muted-foreground"
        )}>
          {error ? (
            <><Wifi className="h-2.5 w-2.5" /> Could not refresh — showing last known standings</>
          ) : (
            <>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                inWindow ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              )} />
              {inWindow
                ? `Auto-refreshing every 30s during match window${lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}`
                : `Auto-refreshing every 2 min${lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}`
              }
              {totalTips > 0 && <span className="ml-auto">{totalTips} total tips tracked</span>}
            </>
          )}
        </div>
      )}

      {/* Leaderboard table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/10">
            <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-muted-foreground tracking-wider">#</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Tipster</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Pts</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Win%</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider hidden sm:table-cell">W/L</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">ROI</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider hidden md:table-cell">Streak</th>
            {hasPrizes && <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase text-muted-foreground tracking-wider hidden sm:table-cell">Prize</th>}
          </tr>
        </thead>
        <tbody>
          {participants.slice(0, 50).map(p => {
            const prizeInfo = prizeByRank[p.rank]
            return (
              <tr
                key={p.tipsterId}
                className={cn(
                  'border-b border-border hover:bg-muted/30 transition-colors',
                  p.rank === 1 && 'bg-yellow-500/5',
                  p.rank === 2 && 'bg-gray-300/5',
                  p.rank === 3 && 'bg-amber-700/5',
                  currentUserId && p.tipsterId === currentUserId && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                )}
              >
                <td className="px-3 py-1.5">
                  <div className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                    p.rank === 1 && 'bg-yellow-500 text-yellow-950',
                    p.rank === 2 && 'bg-gray-300 text-gray-700',
                    p.rank === 3 && 'bg-amber-700 text-amber-100',
                    p.rank > 3 && 'bg-muted text-muted-foreground',
                  )}>{p.rank}</div>
                </td>
                <td className="px-3 py-1.5">
                  <Link href={tipsterHref(p.username, p.username)} className="flex items-center gap-2 hover:text-primary">
                    {p.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar} alt="" loading="lazy" decoding="async" className="h-7 w-7 rounded-full object-cover bg-muted shrink-0" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
                        {(p.displayName || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate flex items-center gap-1">
                        {p.displayName}
                        {currentUserId && p.tipsterId === currentUserId && (
                          <Badge variant="outline" className="h-3.5 text-[8px] px-1 border-primary text-primary leading-none">You</Badge>
                        )}
                        {p.isVerified && <Star className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />}
                        {p.prizeEligible === false && minimumTips > 1 && (
                          <span className="inline-flex items-center rounded-full bg-muted px-1 py-0.5 text-[8px] font-medium text-muted-foreground border border-border/60 whitespace-nowrap shrink-0">
                            {p.tips}/{minimumTips} tips
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        @{p.username}
                        {p.countryCode && <FlagIcon countryCode={p.countryCode} size="sm" />}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-center text-xs font-bold">{p.points}</td>
                <td className="px-2 py-1.5 text-center text-xs font-semibold text-success">{p.winRate}%</td>
                <td className="px-2 py-1.5 text-center text-xs hidden sm:table-cell">
                  <span className="text-success">{p.won}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-destructive">{p.lost}</span>
                  {p.pending > 0 && <span className="text-warning ml-0.5">+{p.pending}</span>}
                </td>
                <td className="px-2 py-1.5 text-center text-xs font-semibold text-primary">
                  {p.roi >= 0 ? '+' : ''}{p.roi}%
                </td>
                <td className="px-2 py-1.5 text-center hidden md:table-cell">
                  {p.streak > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      <Flame className="h-2.5 w-2.5" />{p.streak}
                    </span>
                  )}
                </td>
                {hasPrizes && (
                  <td className="px-2 py-1.5 text-right hidden sm:table-cell">
                    {prizeInfo ? (
                      <span className={cn(
                        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap',
                        p.rank === 1 && 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/40',
                        p.rank === 2 && 'bg-gray-400/15 text-gray-500 dark:text-gray-300 border border-gray-400/30',
                        p.rank === 3 && 'bg-amber-700/15 text-amber-700 dark:text-amber-500 border border-amber-700/30',
                        p.rank > 3  && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                      )}>
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '🏅'}
                        {' '}{currency} {prizeInfo.amount.toLocaleString()}
                      </span>
                    ) : null}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {participants.length > 50 && (
        <div className="border-t border-border bg-muted/10 px-3 py-2 text-center text-[10px] text-muted-foreground">
          Showing top 50 of {participants.length.toLocaleString()} tipsters
        </div>
      )}

      {participants.length === 0 && (
        <div className="py-10 px-6 text-center space-y-2">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No qualifying tips yet</p>
          {(leagueName || matchKickoffFrom) ? (
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Only tips on <span className="font-semibold text-foreground">{leagueName ?? sportFocus ?? 'qualifying matches'}</span>
              {matchKickoffFrom ? ' in the selected round' : ''} count.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No tips posted yet — be the first to compete!</p>
          )}
        </div>
      )}
    </div>
  )
}
