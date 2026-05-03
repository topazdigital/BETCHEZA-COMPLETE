"use client"

import { useState, use, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import {
  ArrowLeft, Clock, Radio, Share2, Bookmark, CheckCircle2,
  Trophy, BarChart3, Shirt, Newspaper, MapPin, Tv,
  TrendingUp, Award, ChevronUp, ChevronDown, Minus,
  Users, Zap, AlertTriangle, RotateCcw, Target,
  Star, ThumbsUp, ThumbsDown, MessageCircle, Lock, ChevronRight,
  Calendar,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { Spinner } from "@/components/ui/spinner"
import { TeamLogo } from "@/components/ui/team-logo"
import { PlayerAvatar } from "@/components/ui/player-avatar"
import { cn } from "@/lib/utils"
import { teamHref, playerHref, tipsterHref } from "@/lib/utils/slug"
import { formatTime, formatDate, getBrowserTimezone, getDayLabel } from "@/lib/utils/timezone"
import { FlagIcon } from "@/components/ui/flag-icon"
import { liveStatusLabel } from "@/lib/utils/live-status"
import { matchIdToSlug, matchToSlug } from "@/lib/utils/match-url"
import { AIMatchPrediction } from "@/components/ai/ai-match-prediction"
import { AIMultiMarket } from "@/components/ai/ai-multi-market"
import { AddTipForm } from "@/components/matches/add-tip-form"
import { MatchFacts } from "@/components/matches/match-facts"
import { WinnerVote } from "@/components/matches/winner-vote"
import { useAuth } from "@/contexts/auth-context"
import { useMatches } from "@/lib/hooks/use-matches"
import { useBetSlip } from "@/contexts/bet-slip-context"
import { isMinuteTickingSport, isLiveMatchStatus } from "@/lib/utils/live-status"

// Sports where a draw is not a possible outcome (so the vote widget hides it).
const NO_DRAW_SPORTS = new Set([
  'basketball', 'tennis', 'baseball', 'ice-hockey', 'hockey',
  'american-football', 'football-american', 'volleyball', 'mma', 'boxing',
  'esports', 'darts', 'snooker',
])

interface PageProps { params: Promise<{ id: string }> }

interface Player {
  id?: string
  name: string
  fullName?: string
  position?: string
  jersey?: string
  starter: boolean
  headshot?: string
}
interface TeamRoster {
  teamId?: string
  teamName?: string
  teamLogo?: string
  formation?: string
  coach?: string
  starting: Player[]
  bench: Player[]
}
interface Lineups { home: TeamRoster | null; away: TeamRoster | null }
interface BookmakerOdd {
  bookmaker: string
  home: number
  draw?: number
  away: number
  spread?: { value: number; homePrice: number; awayPrice: number }
  total?: { value: number; overPrice: number; underPrice: number }
  /** Per-side deeplinks to the book's bet slip (SGO-only). */
  links?: { home?: string; draw?: string; away?: string }
}
interface H2HGame {
  matchId?: string
  date: string
  league?: string
  home: { name: string; logo?: string; score?: number }
  away: { name: string; logo?: string; score?: number }
}
interface StandingRow {
  teamId?: string
  teamName?: string
  teamLogo?: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor?: number
  goalsAgainst?: number
  goalDifference?: number
  points: number
  position?: number
}
interface StandingsGroup { header?: string; rows: StandingRow[] }
interface NewsItem {
  id?: string
  headline?: string
  description?: string
  published?: string
  image?: string
  link?: string
  source?: string
}
interface LeaderItem {
  team?: string
  teamId?: string
  category?: string
  athlete?: string
  athleteId?: string
  headshot?: string
  value?: string
}
interface MatchEvent {
  id: string
  minute: string
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow_card' | 'red_card' | 'yellow_red_card' | 'substitution' | 'var' | 'other'
  side: 'home' | 'away'
  playerName?: string
  playerId?: string
  playerOut?: string
  playerOutId?: string
  assistName?: string
  assistId?: string
  homeScore?: number
  awayScore?: number
  description?: string
  period?: number
}
interface SegmentBreakdown {
  variant: 'quarters' | 'periods' | 'innings' | 'sets' | 'rounds' | 'generic'
  labels: string[]
  home: number[]
  away: number[]
  totals?: { home: number; away: number }
}
interface MarketOutcome { name: string; price: number; point?: number }
interface MatchMarket { key: string; name: string; outcomes: MarketOutcome[] }
interface MatchDetails {
  match: {
    id: string
    homeTeam: { name: string; logo?: string; form?: string; record?: string; espnTeamId?: string; leagueSlug?: string }
    awayTeam: { name: string; logo?: string; form?: string; record?: string; espnTeamId?: string; leagueSlug?: string }
    kickoffTime: string
    status: string
    homeScore: number | null
    awayScore: number | null
    minute?: number
    period?: number
    league: { name: string; country: string; countryCode: string; slug?: string }
    sport: { name: string; slug: string; icon: string }
    odds?: { home: number; draw?: number; away: number; bookmaker?: string }
    oddsIsComputed?: boolean
    markets?: MatchMarket[]
    venue?: string
    venueCity?: string
    venueCountry?: string
    attendance?: number
    broadcasts?: string[]
  }
  bookmakerOdds: BookmakerOdd[]
  lineups: Lineups | null
  h2h: H2HGame[] | null
  standings: StandingsGroup[] | null
  news: NewsItem[]
  leaders: LeaderItem[]
  matchEvents: MatchEvent[]
  segmentBreakdown: SegmentBreakdown | null
  teamStats: TeamStatsBlock | null
  hasRealOdds: boolean
  hasLineups: boolean
  hasStandings: boolean
  hasH2H: boolean
  hasEvents: boolean
  hasTeamStats: boolean
}

interface TeamStatRow {
  name: string
  label: string
  abbreviation?: string
  displayValue: string
}
interface TeamStatsBlock {
  home: { team?: { id?: string; displayName?: string; abbreviation?: string; logo?: string }; stats: TeamStatRow[] }
  away: { team?: { id?: string; displayName?: string; abbreviation?: string; logo?: string }; stats: TeamStatRow[] }
}

interface TipsterInfo {
  id: string
  username?: string
  avatar?: string
  displayName: string
  totalTips: number
  wonTips: number
  winRate: number
  roi: number
  streak: number
  rank: number
  isPremium: boolean
  monthlyPrice: number
  followers: number
  verified: boolean
}
interface MatchTip {
  id: string
  matchId: string
  prediction: string
  market: string
  odds: number
  stake: number
  confidence: number
  analysis: string
  isPremium: boolean
  status: string
  likes: number
  liked?: boolean
  dislikes: number
  comments: number
  createdAt: string
  tipster: TipsterInfo
}

interface TipCommentDto {
  id: string
  authorName: string
  content: string
  createdAt: string
}
interface TipsData { tips: MatchTip[]; total: number }

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

// Slug → emoji. NOTE: in this app the sport with id=1 is "Football" (soccer)
// with slug 'football' — id=5 is American Football with slug 'american-football'.
// So `football` must render the soccer ball, not the American football.
const SPORT_EMOJI: Record<string, string> = {
  soccer: '⚽', football: '⚽',
  'american-football': '🏈',
  basketball: '🏀', tennis: '🎾',
  baseball: '⚾', hockey: '🏒', 'ice-hockey': '🏒',
  mma: '🥊', boxing: '🥊', cricket: '🏏',
  rugby: '🏉', golf: '⛳',
  'formula-1': '🏎️', racing: '🏎️', motogp: '🏍️', nascar: '🏁',
  volleyball: '🏐', 'beach-volleyball': '🏐',
  handball: '🤾', 'water-polo': '🤽', 'field-hockey': '🏑',
  futsal: '⚽', lacrosse: '🥍', 'aussie-rules': '🏉',
  snooker: '🎱', darts: '🎯', 'table-tennis': '🏓', badminton: '🏸',
  squash: '🎾', cycling: '🚴', athletics: '🏃', swimming: '🏊',
  wrestling: '🤼', 'horse-racing': '🐎',
  esports: '🎮', chess: '♟️', 'ski-jumping': '⛷️',
}

function FormBadge({ result }: { result: string }) {
  const r = result.toUpperCase()
  return (
    <span className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white",
      r === 'W' && "bg-emerald-500",
      r === 'D' && "bg-amber-500",
      r === 'L' && "bg-rose-500",
      !['W', 'D', 'L'].includes(r) && "bg-muted-foreground"
    )}>{r}</span>
  )
}

function EventIcon({ type }: { type: MatchEvent['type'] }) {
  if (type === 'goal') return <span className="text-base">⚽</span>
  if (type === 'own_goal') return <span className="text-base">🔴</span>
  if (type === 'penalty_goal') return <span className="text-base">⚽</span>
  if (type === 'yellow_card') return <span className="inline-block h-4 w-3 rounded-sm bg-yellow-400 shadow-sm" />
  if (type === 'red_card') return <span className="inline-block h-4 w-3 rounded-sm bg-rose-500 shadow-sm" />
  if (type === 'yellow_red_card') return <span className="inline-block h-4 w-3 rounded-sm bg-orange-500 shadow-sm" />
  if (type === 'substitution') return <RotateCcw className="h-4 w-4 text-sky-400" />
  if (type === 'var') return <Tv className="h-4 w-4 text-violet-400" />
  return <Zap className="h-4 w-4 text-muted-foreground" />
}

// ---- Live Minute Timer ----
// IMPORTANT: We mirror the match-card behaviour exactly: trust the API's
// `minute` field as the source of truth (ESPN updates it every poll, our
// SWR refreshInterval is 20 s). Between polls we tick the clock locally
// for soccer / football / rugby so the seconds keep moving naturally —
// but we always anchor to the API value rather than to kickoff time
// (kickoff-based ticking was wrong for delayed kick-offs, halftime, ET).
function useLiveMinute(storedMinute: number | undefined, status: string, sportSlug: string = 'soccer', kickoffTime?: string, liveClock?: string) {
  const [minute, setMinute] = useState(storedMinute ?? 0)
  const isLive = status === 'live' || status === 'extra_time' || status === 'penalties'
  const isHalftime = status === 'halftime'
  const ticksByMinute = sportSlug === 'soccer' || sportSlug === 'football' || sportSlug === 'rugby'

  // Reset local minute whenever the API hands us a fresh value.
  useEffect(() => { setMinute(storedMinute ?? 0) }, [storedMinute])

  useEffect(() => {
    if (liveClock) {
      const text = liveClock.trim()
      const plus = text.match(/^(\d+)(?:\+(\d+))?'?$/)
      const mmss = text.match(/^(\d+):(\d+)$/)
      const hasRemaining = /remaining|left/i.test(text)
      if (plus) {
        setMinute(parseInt(plus[1], 10) + (plus[2] ? parseInt(plus[2], 10) : 0))
        return
      }
      if (mmss) {
        const mins = parseInt(mmss[1], 10)
        const secs = parseInt(mmss[2], 10)
        const elapsed = hasRemaining ? Math.max(0, mins - (secs > 0 ? 1 : 0)) : mins
        setMinute(status === 'halftime' ? 45 : elapsed)
        return
      }
      const plain = text.match(/^(\d+)$/)
      if (plain) {
        setMinute(parseInt(plain[1], 10))
        return
      }
    }
    if (isHalftime) { setMinute(45); return }
    if (!isLive || !ticksByMinute || !kickoffTime) return
    const kickoff = new Date(kickoffTime).getTime()
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - kickoff + 60000) / 60000))
      setMinute(Math.min(elapsed, 120))
    }
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [isLive, isHalftime, ticksByMinute, kickoffTime, liveClock, status])

  return minute
}

// ---- Formation Pitch Component ----
//
// Player position bucketing — the previous implementation just sliced the
// starters list into `[1, ...formation]` chunks which only worked when the
// upstream rank matched the formation segments exactly. That broke for any
// formation with multiple midfield lines (4-2-3-1, 4-1-2-1-2, 3-4-1-2, …):
// CDMs ended up next to CAMs, wingers landed in the midfield row, etc.
//
// The new approach classifies every starter into a granular role bucket
// (GK/DEF/DM/CM/AM/WING/FW) using the position abbreviation, then
// allocates each formation row from its preferred bucket — falling back to
// neighbouring buckets when a team's lineup doesn't perfectly fit the named
// shape.
type Role = 'GK' | 'DEF' | 'DM' | 'CM' | 'AM' | 'WING' | 'FW'

// ESPN encodes lateral position as a dash-suffix: "CD-L", "CM-R", "CF-L" etc.
// Extract it so the rest of the logic can stay position-agnostic.
function espnSuffix(pos: string): 'L' | 'R' | 'C' {
  if (pos.endsWith('-L')) return 'L'
  if (pos.endsWith('-R')) return 'R'
  return 'C'
}

function classifyPlayer(p: Player): Role {
  const pos = (p.position || '').toUpperCase().trim()
  if (!pos) return 'CM'

  if (pos === 'G' || pos === 'GK' || pos.startsWith('GOAL')) return 'GK'

  // Defensive midfielders
  if (/CDM|DMF|^DM\b|DEFENSIVE\s*MID/.test(pos)) return 'DM'
  // Attacking midfielders — ESPN uses bare "AM" for this role
  if (/CAM|AMF|^AM$|ATTACK.*MID|SS\b|SECONDARY/.test(pos)) return 'AM'
  // Wide players / wing-midfielders (LM/RM in ESPN = wide midfielders)
  if (/^LW\b|^RW\b|WING|^LM\b|^RM\b|LWF|RWF/.test(pos)) return 'WING'
  // Central midfielders — ESPN: CM, CM-L, CM-R, MF, M
  if (/^CM\b|^MC|MIDFIELD|^M\b|^MF\b/.test(pos)) return 'CM'
  // Forwards — ESPN: CF, CF-L, CF-R, ST, FW, F
  if (/^CF\b|^ST\b|^FW\b|^F\b|STRIK|FORWARD/.test(pos)) return 'FW'
  // Defenders — ESPN uses both CB *and* CD (Center Defender) for centre-backs
  if (/^CB\b|^CD\b|^LB\b|^RB\b|^LWB|^RWB|^SW\b|DEFEND|BACK|^D\b|^DF\b/.test(pos)) return 'DEF'
  return 'CM'
}

// For a formation with `n` lines (excluding GK), what role does each line
// represent from defence to attack?
function rolesForLines(n: number): Role[] {
  if (n <= 1) return ['CM']
  if (n === 2) return ['DEF', 'FW']
  if (n === 3) return ['DEF', 'CM', 'FW']
  if (n === 4) return ['DEF', 'DM', 'AM', 'FW']
  if (n === 5) return ['DEF', 'DM', 'CM', 'AM', 'FW']
  // Anything more exotic — fall back to generic mid lines between DEF/FW.
  const out: Role[] = ['DEF']
  for (let i = 0; i < n - 2; i++) out.push('CM')
  out.push('FW')
  return out
}

// When a row's preferred bucket is empty/short, fall back to neighbouring
// buckets in priority order. Tuned so wingers can fill an attacking row,
// CMs can fill a DM gap, etc.
const FALLBACK: Record<Role, Role[]> = {
  GK:   ['GK'],
  DEF:  ['DEF', 'DM'],
  DM:   ['DM', 'CM', 'DEF'],
  CM:   ['CM', 'AM', 'DM', 'WING'],
  AM:   ['AM', 'CM', 'WING'],
  WING: ['WING', 'AM', 'FW', 'CM'],
  FW:   ['FW', 'WING', 'AM'],
}

// L → C → R so a row reads left-flank to right-flank.
// ESPN encodes side as a dash-suffix ("CD-L", "CM-R") rather than a prefix,
// so we check the suffix first and fall back to leading-letter for classic
// abbreviations (LB, RB, LW, RW …).
function sideRank(p: Player): number {
  const pos = (p.position || '').toUpperCase()
  const suffix = espnSuffix(pos)
  if (suffix === 'L') return 0
  if (suffix === 'R') return 2
  if (pos.startsWith('L')) return 0
  if (pos.startsWith('R')) return 2
  return 1
}

// Priority for filling the DEF row: pure centre-backs (CB / CD in ESPN) are
// preferred over fullbacks and wing-backs so that in a 3-back formation the
// three CBs fill the defensive line and fullbacks overflow to midfield.
function defPriority(p: Player): number {
  const pos = (p.position || '').toUpperCase()
  if (/^CB\b|^CD\b/.test(pos)) return 0  // Centre-backs: highest priority
  if (/^LWB|^RWB/.test(pos)) return 2    // Wing-backs: lowest (play as mids)
  return 1                                 // Full-backs: middle
}

function parseFormation(f?: string): number[] {
  if (!f) return [4, 4, 2]
  const parts = f.split('-').map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0)
  return parts.length ? parts : [4, 4, 2]
}

interface PitchData {
  team: TeamRoster
  // Columns from defence (back) to attack (front). The first column is the GK.
  columns: Player[][]
}

function buildPitchData(roster: TeamRoster | null): PitchData | null {
  if (!roster) return null
  const starters = roster.starting.slice(0, 11)
  const formation = parseFormation(roster.formation)

  // Group starters into role buckets, then sort each bucket by side.
  const buckets: Record<Role, Player[]> = {
    GK: [], DEF: [], DM: [], CM: [], AM: [], WING: [], FW: [],
  }
  for (const p of starters) buckets[classifyPlayer(p)].push(p)
  for (const k of Object.keys(buckets) as Role[]) {
    if (k === 'DEF') {
      // Sort DEF bucket by CB-priority first so that in a 3-back formation
      // the centre-backs fill the row before fullbacks/wing-backs do.
      buckets[k].sort((a, b) => {
        const pd = defPriority(a) - defPriority(b)
        if (pd !== 0) return pd
        return sideRank(a) - sideRank(b)
      })
    } else {
      buckets[k].sort((a, b) => sideRank(a) - sideRank(b))
    }
  }

  const lineRoles = rolesForLines(formation.length)
  const roles: Role[] = ['GK', ...lineRoles]
  const counts: number[] = [1, ...formation]

  const columns: Player[][] = roles.map(() => [])

  // First pass: fill each row from its preferred bucket and fallbacks.
  for (let i = 0; i < roles.length; i++) {
    const need = counts[i]
    for (const fb of FALLBACK[roles[i]]) {
      while (columns[i].length < need && buckets[fb].length) {
        columns[i].push(buckets[fb].shift()!)
      }
      if (columns[i].length >= need) break
    }
  }

  // Second pass: any leftover players (rare — happens when classification
  // doesn't match the stated formation) get dropped into whichever row still
  // has the most slack so we never silently lose a starter.
  const leftovers = (Object.keys(buckets) as Role[]).flatMap(k => buckets[k])
  for (const p of leftovers) {
    let best = -1
    let bestSlack = 0
    for (let i = 1; i < counts.length; i++) {
      const slack = counts[i] - columns[i].length
      if (slack > bestSlack) { best = i; bestSlack = slack }
    }
    if (best === -1) best = columns.length - 1 // dump into attack row as a last resort
    columns[best].push(p)
  }

  // Re-sort each non-GK row by side after fallback fills so the column reads
  // L→C→R top-to-bottom.
  for (let i = 1; i < columns.length; i++) {
    columns[i].sort((a, b) => sideRank(a) - sideRank(b))
  }

  return { team: roster, columns }
}

function FormationPitch({ home, away }: { home: TeamRoster | null; away: TeamRoster | null }) {
  if (!home && !away) return null
  const homeData = buildPitchData(home)
  const awayData = buildPitchData(away)

  return (
    <>
      {/* Horizontal pitch — desktop / tablet */}
      <div className="hidden md:block">
        <HorizontalPitch home={homeData} away={awayData} />
      </div>
      {/* Vertical pitch — mobile, gives each player enough room to breathe */}
      <div className="md:hidden">
        <VerticalPitch home={homeData} away={awayData} />
      </div>
    </>
  )
}

function TeamHeader({ team, align }: { team: TeamRoster; align: 'left' | 'right' | 'center' }) {
  const justify = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'
  return (
    <div className={cn('flex items-center gap-2 px-2 py-1.5', justify)}>
      {align !== 'right' && <TeamLogo teamName={team.teamName || ''} logoUrl={team.teamLogo} size="sm" />}
      <span className="text-xs font-bold text-white/90 truncate">{team.teamName}</span>
      {team.formation && (
        <span className="text-[10px] text-white/60 bg-black/30 px-1.5 py-0.5 rounded-full shrink-0">
          {team.formation}
        </span>
      )}
      {align === 'right' && <TeamLogo teamName={team.teamName || ''} logoUrl={team.teamLogo} size="sm" />}
    </div>
  )
}

// Horizontal pitch — home on the left half, away on the right half.
function HorizontalPitch({ home, away }: { home: PitchData | null; away: PitchData | null }) {
  // Reverse the away columns so its GK sits on the far right and its attack
  // meets home's defence in the middle.
  const awayColumns = away ? [...away.columns].reverse() : []
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ background: 'linear-gradient(90deg, #1a5c2a 0%, #1e7a35 50%, #1a5c2a 100%)' }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 600 400" preserveAspectRatio="none">
        <rect x="20" y="20" width="560" height="360" fill="none" stroke="white" strokeWidth="2" />
        <line x1="300" y1="20" x2="300" y2="380" stroke="white" strokeWidth="2" />
        <circle cx="300" cy="200" r="55" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="300" cy="200" r="3" fill="white" />
        <rect x="20" y="110" width="100" height="180" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="20" y="155" width="50" height="90" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="100" cy="200" r="3" fill="white" />
        <rect x="480" y="110" width="100" height="180" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="530" y="155" width="50" height="90" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="500" cy="200" r="3" fill="white" />
      </svg>

      <div className="relative flex items-stretch gap-1 px-2 py-3" style={{ minHeight: 360 }}>
        <div className="flex-1 flex flex-col min-w-0">
          {home && <TeamHeader team={home.team} align="left" />}
          <div className="flex flex-1 items-stretch justify-around gap-0.5">
            {home?.columns.map((col, ci) => (
              <div key={ci} className="flex flex-1 flex-col justify-around items-center gap-1.5 py-1 min-w-0">
                {col.map((p, pi) => <PitchPlayer key={pi} player={p} color="bg-rose-500" />)}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center opacity-50 px-0.5">
          <div className="w-px flex-1 bg-white/40" />
          <div className="h-2 w-2 my-1 rounded-full bg-white/60" />
          <div className="w-px flex-1 bg-white/40" />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {away && <TeamHeader team={away.team} align="right" />}
          <div className="flex flex-1 items-stretch justify-around gap-0.5">
            {awayColumns.map((col, ci) => (
              <div key={ci} className="flex flex-1 flex-col justify-around items-center gap-1.5 py-1 min-w-0">
                {col.map((p, pi) => <PitchPlayer key={pi} player={p} color="bg-sky-500" />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Vertical pitch — home on top with attack pointing down, away on bottom
// with attack pointing up. The two attack lines meet at the centre line.
function VerticalPitch({ home, away }: { home: PitchData | null; away: PitchData | null }) {
  // Away rows render top-to-bottom as: FW … DEF, GK. So we don't reverse —
  // the columns array is already back-to-front, which is exactly what we want
  // when the away team is on the bottom half.
  const awayColumnsTopDown = away ? [...away.columns].reverse() : []
  // Home rows render top-to-bottom as: GK, DEF … FW. The columns array is
  // already in the right order.
  const homeColumnsTopDown = home?.columns ?? []
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ background: 'linear-gradient(180deg, #1a5c2a 0%, #1e7a35 50%, #1a5c2a 100%)' }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 400 700" preserveAspectRatio="none">
        <rect x="20" y="20" width="360" height="660" fill="none" stroke="white" strokeWidth="2" />
        <line x1="20" y1="350" x2="380" y2="350" stroke="white" strokeWidth="2" />
        <circle cx="200" cy="350" r="55" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="200" cy="350" r="3" fill="white" />
        {/* Home penalty area (TOP) */}
        <rect x="110" y="20" width="180" height="100" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="155" y="20" width="90" height="50" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="200" cy="100" r="3" fill="white" />
        {/* Away penalty area (BOTTOM) */}
        <rect x="110" y="580" width="180" height="100" fill="none" stroke="white" strokeWidth="1.5" />
        <rect x="155" y="630" width="90" height="50" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="200" cy="600" r="3" fill="white" />
      </svg>

      <div className="relative flex flex-col px-2 py-2" style={{ minHeight: 540 }}>
        {/* Home — top */}
        <div className="flex-1 flex flex-col min-h-0">
          {home && <TeamHeader team={home.team} align="center" />}
          <div className="flex flex-1 flex-col items-stretch justify-around gap-1">
            {homeColumnsTopDown.map((row, ri) => (
              <div key={ri} className="flex justify-around items-center gap-1 px-2">
                {row.map((p, pi) => <PitchPlayer key={pi} player={p} color="bg-rose-500" />)}
              </div>
            ))}
          </div>
        </div>

        {/* Halfway divider */}
        <div className="flex items-center justify-center gap-2 py-1 opacity-50">
          <div className="h-px flex-1 bg-white/40" />
          <div className="h-2 w-2 rounded-full bg-white/60" />
          <div className="h-px flex-1 bg-white/40" />
        </div>

        {/* Away — bottom */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-1 flex-col items-stretch justify-around gap-1">
            {awayColumnsTopDown.map((row, ri) => (
              <div key={ri} className="flex justify-around items-center gap-1 px-2">
                {row.map((p, pi) => <PitchPlayer key={pi} player={p} color="bg-sky-500" />)}
              </div>
            ))}
          </div>
          {away && <TeamHeader team={away.team} align="center" />}
        </div>
      </div>
    </div>
  )
}

function PitchPlayer({ player, color: _color }: { player: Player; color: string }) {
  // Wrap whole tile in a Link to /players/{id} when we have an ESPN id.
  // Use the shared PlayerAvatar so the headshot fallback chain (player headshot →
  // ESPN /full/<id>.png → ESPN /default/<id>.png → coloured initials) is consistent
  // with the rest of the site instead of falling back to the jersey number when
  // ESPN's full headshot 404s.
  const inner = (
    <div className="flex flex-col items-center gap-0.5 w-12">
      <div className="relative">
        <PlayerAvatar
          id={player.id}
          name={player.name}
          headshot={player.headshot}
          jersey={player.jersey}
          size="md"
          ring="none"
          noLink
          imgClassName="border-2 border-white/50 shadow-lg"
        />
      </div>
      <span className="text-[9px] text-white/90 text-center leading-tight line-clamp-1 w-full text-center px-1">
        {player.name.split(' ').pop() || player.name}
      </span>
    </div>
  )
  if (player.id) {
    return (
      <Link
        href={playerHref(player.name, player.id)}
        title={player.name}
        className="transition-transform hover:scale-110"
      >
        {inner}
      </Link>
    )
  }
  return inner
}

// ---- Compact Hero Timeline Bar ----
// Shows a horizontal progress bar (0–90+ min) with event markers for goals,
// cards and substitutions so users can see the match rhythm at a glance.
function HeroTimeline({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) return null
  // Parse minute string like "45'", "45+2'" → numeric minute for positioning
  function parseMins(min: string | undefined): number {
    if (!min) return 0
    const m = min.replace(/'/g, '').replace(/\+\d+$/, '')
    return Math.max(0, Math.min(95, parseInt(m, 10) || 0))
  }
  const maxMin = 90
  function pct(min: number) { return `${Math.min(100, (min / maxMin) * 100)}%` }

  const eventIcon = (type: string, side: 'home' | 'away') => {
    if (type === 'goal' || type === 'penalty_goal') return '⚽'
    if (type === 'own_goal') return '🔴'
    if (type === 'yellow_card') return '🟨'
    if (type === 'red_card' || type === 'yellow_red_card') return '🟥'
    if (type === 'substitution') return side === 'home' ? '↕' : '↕'
    return '•'
  }

  return (
    <div className="px-3 pb-2">
      <div className="relative h-6 w-full">
        {/* Track */}
        <div className="absolute inset-y-[11px] left-0 right-0 h-[2px] rounded-full bg-white/10" />
        {/* Half-time marker */}
        <div className="absolute inset-y-0 flex flex-col items-center justify-center" style={{ left: pct(45) }}>
          <div className="h-3 w-[1px] bg-white/20" />
        </div>
        {/* Event markers */}
        {events.map((ev, i) => {
          const min = parseMins(ev.minute)
          const isGoal = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_goal'
          const icon = eventIcon(ev.type, ev.side)
          const isHome = ev.side === 'home'
          return (
            <div
              key={ev.id || i}
              className="absolute flex flex-col items-center"
              style={{ left: pct(min), transform: 'translateX(-50%)' }}
              title={`${ev.minute} ${ev.playerName || ''} (${ev.type.replace(/_/g, ' ')})`}
            >
              <span className={cn(
                "text-[8px] leading-none select-none",
                isGoal ? "text-base" : "text-[10px]",
                isHome ? "-translate-y-1" : "translate-y-1",
              )}>
                {icon}
              </span>
            </div>
          )
        })}
      </div>
      {/* Minute labels */}
      <div className="flex justify-between text-[8px] text-white/25 mt-0.5 px-0.5">
        <span>0&apos;</span>
        <span>45&apos;</span>
        <span>90&apos;</span>
      </div>
    </div>
  )
}

// ---- Match Events Timeline ----
function EventsTimeline({ events, homeName, awayName }: { events: MatchEvent[]; homeName: string; awayName: string }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Zap className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-semibold">Match events will appear here</p>
        <p className="text-sm mt-1">Events update live once the match kicks off</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {events.map((ev) => {
        const isHome = ev.side === 'home'
        const isGoal = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_goal'
        return (
          <div key={ev.id} className={cn(
            "grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 px-3 rounded-lg transition-colors",
            isGoal ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
          )}>
            {/* Home side */}
            {isHome ? (
              <div className="flex items-center gap-2 justify-end min-w-0">
                <div className="text-right min-w-0">
                  <p className={cn("text-sm font-semibold truncate", isGoal && "text-foreground")}>{ev.playerName || '—'}</p>
                  {ev.type === 'substitution' && ev.playerOut && (
                    <p className="text-[10px] text-rose-400 truncate">↓ {ev.playerOut}</p>
                  )}
                  {ev.assistName && <p className="text-[10px] text-muted-foreground truncate">Assist: {ev.assistName}</p>}
                  {ev.type === 'own_goal' && <p className="text-[10px] text-rose-400">Own Goal</p>}
                  {ev.type === 'penalty_goal' && <p className="text-[10px] text-emerald-400">Penalty</p>}
                </div>
                <EventIcon type={ev.type} />
              </div>
            ) : <div />}

            {/* Center: minute + score snapshot */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-mono font-bold text-muted-foreground w-12 text-center leading-none">
                {ev.minute}
              </span>
              {isGoal && ev.homeScore !== undefined && ev.awayScore !== undefined && (
                <span className="text-[10px] font-bold text-primary mt-0.5">
                  {ev.homeScore}–{ev.awayScore}
                </span>
              )}
            </div>

            {/* Away side */}
            {!isHome ? (
              <div className="flex items-center gap-2 min-w-0">
                <EventIcon type={ev.type} />
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold truncate", isGoal && "text-foreground")}>{ev.playerName || '—'}</p>
                  {ev.type === 'substitution' && ev.playerOut && (
                    <p className="text-[10px] text-rose-400 truncate">↓ {ev.playerOut}</p>
                  )}
                  {ev.assistName && <p className="text-[10px] text-muted-foreground truncate">Assist: {ev.assistName}</p>}
                  {ev.type === 'own_goal' && <p className="text-[10px] text-rose-400">Own Goal</p>}
                  {ev.type === 'penalty_goal' && <p className="text-[10px] text-emerald-400">Penalty</p>}
                </div>
              </div>
            ) : <div />}
          </div>
        )
      })}
    </div>
  )
}

// ---- Odds Probability Bar ----
function OddsProbBar({ home, draw, away }: { home: number; draw?: number; away: number }) {
  const toProb = (o: number) => Math.round((1 / o) * 100)
  const hp = toProb(home)
  const dp = draw ? toProb(draw) : 0
  const ap = toProb(away)
  const total = hp + dp + ap
  const hPct = Math.round((hp / total) * 100)
  const dPct = Math.round((dp / total) * 100)
  const aPct = 100 - hPct - dPct

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div className="bg-emerald-500 transition-all" style={{ width: `${hPct}%` }} />
        {dPct > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${dPct}%` }} />}
        <div className="bg-rose-500 transition-all" style={{ width: `${aPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="text-emerald-600 font-medium">{hPct}%</span>
        {dPct > 0 && <span className="text-amber-500 font-medium">{dPct}%</span>}
        <span className="text-rose-500 font-medium">{aPct}%</span>
      </div>
    </div>
  )
}

// ---- Sport-specific score breakdown grid ----
// Renders quarters / periods / innings / sets / rounds in a tight, readable grid.
// One component handles every sport — labels and totals come from the API.
function SegmentBreakdownGrid({
  data,
  homeName,
  awayName,
  homeLogo,
  awayLogo,
}: {
  data: SegmentBreakdown
  homeName: string
  awayName: string
  homeLogo?: string
  awayLogo?: string
}) {
  if (!data || data.labels.length === 0) return null

  const heading: Record<SegmentBreakdown['variant'], string> = {
    quarters: 'Quarter-by-quarter',
    periods: 'Period-by-period',
    innings: 'Inning-by-inning',
    sets: 'Set-by-set',
    rounds: 'Round-by-round',
    generic: 'Score by segment',
  }

  // Choose how to colour the winning side per segment (small visual cue).
  const cellClass = (a: number, b: number) =>
    a > b
      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
      : a < b
        ? 'text-muted-foreground'
        : 'text-foreground font-medium'

  return (
    <div className="rounded-xl border border-border bg-card p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading[data.variant]}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-center text-sm tabular-nums">
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground">
              <th className="px-1.5 py-1 text-left font-medium">Team</th>
              {data.labels.map((l) => (
                <th key={l} className="px-1.5 py-1 font-medium">{l}</th>
              ))}
              <th className="px-1.5 py-1 font-semibold text-foreground">T</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="px-1.5 py-1.5 text-left">
                <div className="flex items-center gap-2">
                  {homeLogo ? <img src={homeLogo} alt="" className="h-4 w-4 rounded-sm object-contain" /> : null}
                  <span className="truncate text-xs font-medium">{homeName}</span>
                </div>
              </td>
              {data.home.map((v, i) => (
                <td key={i} className={cn('px-1.5 py-1.5', cellClass(v, data.away[i] ?? 0))}>{v}</td>
              ))}
              <td className="px-1.5 py-1.5 text-base font-bold">{data.totals?.home ?? data.home.reduce((a, b) => a + b, 0)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-1.5 py-1.5 text-left">
                <div className="flex items-center gap-2">
                  {awayLogo ? <img src={awayLogo} alt="" className="h-4 w-4 rounded-sm object-contain" /> : null}
                  <span className="truncate text-xs font-medium">{awayName}</span>
                </div>
              </td>
              {data.away.map((v, i) => (
                <td key={i} className={cn('px-1.5 py-1.5', cellClass(v, data.home[i] ?? 0))}>{v}</td>
              ))}
              <td className="px-1.5 py-1.5 text-base font-bold">{data.totals?.away ?? data.away.reduce((a, b) => a + b, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Scorers inline display for hero ----
function PlayerLink({ name, id }: { name?: string; id?: string }) {
  if (!name) return <span className="italic text-white/40">?</span>
  const href = id ? `/players/${id}` : `/search?q=${encodeURIComponent(name)}`
  return (
    <Link href={href} className="hover:underline hover:text-white transition-colors" onClick={e => e.stopPropagation()}>
      {name}
    </Link>
  )
}

function ScorersList({ events, side }: { events: MatchEvent[]; side: 'home' | 'away' }) {
  const goals = events.filter(e => e.side === side && (e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty_goal'))
  if (goals.length === 0) return null
  return (
    <div className={cn("flex flex-col gap-0.5 mt-2", side === 'home' ? "items-end" : "items-start")}>
      {goals.map((g, i) => (
        <span key={i} className={cn("flex items-center gap-1 text-[11px] text-white/80", side === 'home' ? "flex-row-reverse" : "flex-row")}>
          <span>{g.type === 'own_goal' ? '🔴' : '⚽'}</span>
          <span className="flex flex-col" style={{ alignItems: side === 'home' ? 'flex-end' : 'flex-start' }}>
            <span className="flex items-center gap-1">
              <PlayerLink name={g.playerName} id={g.playerId} />
              <span className="text-white/50">{g.minute}</span>
            </span>
            {g.assistName && (
              <span className="text-[10px] text-white/45 flex items-center gap-0.5">
                <span>↪</span>
                <PlayerLink name={g.assistName} id={g.assistId} />
              </span>
            )}
          </span>
        </span>
      ))}
    </div>
  )
}

export default function MatchDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const timezone = getBrowserTimezone()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [savedMatch, setSavedMatch] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [tipSubmitted, setTipSubmitted] = useState<null | { label: string; odds: number }>(null)
  const [shareToast, setShareToast] = useState<string | null>(null)
  // Add-Tip modal — auth-aware: signed-out users see a friendly sign-in prompt
  // INSIDE the modal so they never miss it (the old inline form pushed the
  // CTA below the fold).
  const [tipModalOpen, setTipModalOpen] = useState(false)
  const searchParams = useSearchParams()

  // Auto-open the tip modal when ?action=tip is in the URL
  // This is used by the bet slip "Post as Tip" button
  useEffect(() => {
    if (searchParams?.get('action') === 'tip') {
      setTipModalOpen(true)
    }
  }, [searchParams])

  // Hydrate the bookmark state from localStorage on mount so the icon
  // reflects whether THIS match is already saved. We persist locally
  // (always available, even when logged out) and also POST to the server
  // when the user is signed in so the bookmark survives device changes.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('betcheza:bookmarks') || '[]'
      const list = JSON.parse(raw) as string[]
      setSavedMatch(list.includes(id))
    } catch { /* ignore */ }
  }, [id])

  const { data, error, isLoading } = useSWR<MatchDetails>(
    `/api/matches/${encodeURIComponent(id)}/details`,
    fetcher,
    { refreshInterval: 20000 }
  )

  const match0 = data?.match
  const tipsUrl = match0
    ? `/api/matches/${encodeURIComponent(id)}/tips?home=${encodeURIComponent(match0.homeTeam.name)}&away=${encodeURIComponent(match0.awayTeam.name)}`
    : null
  const { data: tipsData } = useSWR<TipsData>(tipsUrl, fetcher)
  const tips = tipsData?.tips || []

  const match = data?.match

  const toggleBookmark = useCallback(() => {
    const next = !savedMatch
    setSavedMatch(next)
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('betcheza:bookmarks') || '[]'
        const list = (JSON.parse(raw) as string[]).filter(x => x !== id)
        if (next) list.unshift(id)
        window.localStorage.setItem('betcheza:bookmarks', JSON.stringify(list.slice(0, 200)))
      } catch { /* ignore */ }
    }
    if (isAuthenticated) {
      // Best-effort server sync — fire-and-forget.
      fetch('/api/bookmarks', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: id }),
      }).catch(() => { /* ignore network errors */ })
    }
  }, [savedMatch, id, isAuthenticated])

  const handleShare = useCallback(async () => {
    if (!match) return
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
    const shareData = {
      title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      text: `${match.homeTeam.name} vs ${match.awayTeam.name} • ${match.league.name}`,
      url: shareUrl,
    }
    // Use the Web Share API on mobile/PWA; fall back to clipboard on desktop.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(shareData)
        return
      } catch { /* user cancelled — fall through to copy */ }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setShareToast('Link copied to clipboard')
        setTimeout(() => setShareToast(null), 2000)
      } catch {
        setShareToast('Could not share')
        setTimeout(() => setShareToast(null), 2000)
      }
    }
  }, [match])

  const { addSelection, isSelected } = useBetSlip()
  const liveClock = (match as { liveClock?: string; period?: string } | null)?.liveClock || (match as { period?: string } | null)?.period

  const isLive = match && isLiveMatchStatus(match.status)
  const isFinished = match?.status === 'finished'
  const isHalftime = match?.status === 'halftime'
  const liveMinute = useLiveMinute(
    match?.minute,
    match?.status || '',
    match?.sport.slug || 'soccer',
    match?.kickoffTime,
    liveClock
  )
  const sportSlug = match?.sport.slug || 'soccer'
  const ticksByMinute = isMinuteTickingSport(sportSlug)
  const liveLabel = liveStatusLabel(sportSlug, match?.status || '', liveMinute)

  if (isLoading) {
    return (
      <div className="flex h-96 flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-10 w-10" />
          <span className="text-sm text-muted-foreground">Loading match...</span>
        </div>
      </div>
    )
  }

  if (error || !data?.match) {
    return (
      <div className="flex-1 p-8 text-center">
        <div className="text-4xl mb-4">🏟️</div>
        <h1 className="text-2xl font-bold">Match not found</h1>
        <p className="mt-2 text-muted-foreground">This match may no longer be available.</p>
        <Button asChild className="mt-6"><Link href="/matches">Back to Matches</Link></Button>
      </div>
    )
  }

  const { bookmakerOdds, lineups, h2h, standings, news, leaders, matchEvents, segmentBreakdown, teamStats, hasRealOdds, hasTeamStats } = data
  const sport = match.sport.slug

  return (
    <div className="flex min-h-0 flex-1">
      {/* LEFT SIDEBAR — Lineups (lg+) */}
      <aside className="hidden lg:block w-64 xl:w-72 shrink-0 border-r border-border">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
          <SidebarLineupsPanel
            lineups={lineups}
            match={match}
            sport={sport}
            hasLineups={!!data?.hasLineups}
          />
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-hidden">
      <div className="px-3 py-2 pb-28 md:px-5 md:py-3 md:pb-8">
        {/* Back */}
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 h-7 text-xs text-muted-foreground hover:text-foreground" asChild>
          <Link href="/matches"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Matches</Link>
        </Button>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">

        {/* ─── HERO CARD (compact, oddspedia-style) ─── */}
        <div className="mb-3 overflow-hidden rounded-xl shadow-lg" style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
        }}>
          {/* League strip */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base shrink-0" aria-hidden>{SPORT_EMOJI[sport] || '🏆'}</span>
              <FlagIcon countryCode={match.league.countryCode} size="xs" className="shrink-0" title={match.league.country} />
              {match.league.slug ? (
                <Link
                  href={`/leagues/${match.league.slug}`}
                  className="text-[11px] font-bold text-white/90 truncate hover:text-white hover:underline uppercase tracking-wider"
                  onClick={e => e.stopPropagation()}
                >
                  {match.league.name}
                </Link>
              ) : (
                <span className="text-[11px] font-bold text-white/90 truncate uppercase tracking-wider">{match.league.name}</span>
              )}
              <span className="text-[10px] text-white/40 shrink-0 hidden sm:inline">• {match.league.country}</span>
            </div>
            <div className="flex items-center gap-1">
              {isLive && !isHalftime && (
                <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  <span className="inline-block h-1 w-1 rounded-full bg-rose-400 animate-pulse" />
                  LIVE {liveLabel !== 'LIVE' ? liveLabel : ''}
                </div>
              )}
              {isHalftime && (
                <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  HT
                </div>
              )}
              {match.status === 'scheduled' && (
                <div className="flex items-center gap-1 bg-white/10 text-white/70 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                  <Clock className="h-2.5 w-2.5" />
                  {getDayLabel(match.kickoffTime, timezone)} {formatTime(match.kickoffTime, timezone)}
                </div>
              )}
              {isFinished && (
                <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-2.5 w-2.5" /> FT
                </div>
              )}
              <button
                onClick={toggleBookmark}
                aria-label={savedMatch ? 'Remove bookmark' : 'Save this match'}
                title={savedMatch ? 'Remove bookmark' : 'Save this match'}
                className="ml-0.5 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <Bookmark className={cn("h-3.5 w-3.5", savedMatch ? "fill-white text-white" : "text-white/50")} />
              </button>
              <button
                onClick={handleShare}
                aria-label="Share this match"
                title="Share this match"
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5 text-white/50" />
              </button>
              {shareToast && (
                <span className="ml-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-1.5 py-0">
                  {shareToast}
                </span>
              )}
            </div>
          </div>

          {/* Teams + Score (compact) */}
          <div className="px-3 py-2 md:px-4 md:py-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
              {/* Home */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-1">
                  <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} size="sm" />
                </div>
                {match.homeTeam.espnTeamId ? (
                  <Link
                    href={teamHref(match.homeTeam.name, match.homeTeam.espnTeamId)}
                    className="text-xs md:text-sm font-bold text-white line-clamp-2 hover:text-white/80 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    {match.homeTeam.name}
                  </Link>
                ) : (
                  <p className="text-xs md:text-sm font-bold text-white line-clamp-2">{match.homeTeam.name}</p>
                )}
                {match.homeTeam.record && (
                  <p className="mt-0.5 text-[9px] text-white/40">{match.homeTeam.record}</p>
                )}
                {match.homeTeam.form && (
                  <div className="mt-0.5 flex gap-0.5 justify-center">
                    {match.homeTeam.form.split('').slice(0, 5).map((r, i) => <FormBadge key={i} result={r} />)}
                  </div>
                )}
                {(isLive || isFinished) && matchEvents.length > 0 && (
                  <ScorersList events={matchEvents} side="home" />
                )}
              </div>

              {/* Score / Time */}
              <div className="flex flex-col items-center min-w-[70px] md:min-w-[90px]">
                {(isLive || isFinished) ? (
                  <>
                    <div className="flex items-center gap-1 md:gap-2 tabular-nums">
                      <span className="text-3xl md:text-4xl font-black text-white leading-none">
                        {match.homeScore ?? 0}
                      </span>
                      <span className="text-lg md:text-2xl font-light text-white/30">:</span>
                      <span className="text-3xl md:text-4xl font-black text-white leading-none">
                        {match.awayScore ?? 0}
                      </span>
                    </div>
                    {isLive && !isHalftime && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="inline-block h-1 w-1 rounded-full bg-rose-400 animate-pulse" />
                        <span className="font-mono text-[10px] font-bold text-rose-400">
                          {ticksByMinute ? `${liveMinute}'` : liveLabel}
                        </span>
                      </div>
                    )}
                    {isHalftime && <p className="mt-0.5 text-[10px] font-bold text-amber-400">HALF TIME</p>}
                    {isFinished && <p className="mt-0.5 text-[10px] text-white/40 font-medium">FULL TIME</p>}
                  </>
                ) : (
                  <>
                    <p className="text-xl md:text-3xl font-bold text-white tabular-nums">
                      {formatTime(match.kickoffTime, timezone)}
                    </p>
                    <p className="mt-1 text-[10px] text-white/40">
                      {getDayLabel(match.kickoffTime, timezone)} • {formatDate(match.kickoffTime, timezone)}
                    </p>
                    <div className="mt-2 text-xl text-white/20 font-light">vs</div>
                  </>
                )}
              </div>

              {/* Away */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-1">
                  <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} size="sm" />
                </div>
                {match.awayTeam.espnTeamId ? (
                  <Link
                    href={teamHref(match.awayTeam.name, match.awayTeam.espnTeamId)}
                    className="text-xs md:text-sm font-bold text-white line-clamp-2 hover:text-white/80 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    {match.awayTeam.name}
                  </Link>
                ) : (
                  <p className="text-xs md:text-sm font-bold text-white line-clamp-2">{match.awayTeam.name}</p>
                )}
                {match.awayTeam.record && (
                  <p className="mt-0.5 text-[9px] text-white/40">{match.awayTeam.record}</p>
                )}
                {match.awayTeam.form && (
                  <div className="mt-0.5 flex gap-0.5 justify-center">
                    {match.awayTeam.form.split('').slice(0, 5).map((r, i) => <FormBadge key={i} result={r} />)}
                  </div>
                )}
                {(isLive || isFinished) && matchEvents.length > 0 && (
                  <ScorersList events={matchEvents} side="away" />
                )}
              </div>
            </div>
          </div>

          {/* Compact hero timeline — shows for live/finished games with events */}
          {(isLive || isFinished) && matchEvents.length > 0 && (
            <HeroTimeline events={matchEvents} />
          )}

          {/* Odds bar — always shown */}
          {match.odds && (
            <div className="px-3 pb-3">
              <div className="rounded-lg bg-white/5 border border-white/10 p-2.5">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <OddsButton
                    label="1"
                    sublabel={match.homeTeam.name.split(' ')[0]}
                    value={match.odds.home}
                    selected={isSelected(match.id, 'h2h', match.homeTeam.name)}
                    onClick={() => addSelection({
                      matchId: match.id,
                      matchName: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                      marketKey: 'h2h',
                      marketName: 'Match Winner',
                      outcomeName: match.homeTeam.name,
                      price: match.odds.home,
                      matchSlug: matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name),
                    })}
                  />
                  {match.odds.draw !== undefined ? (
                    <OddsButton
                      label="X"
                      sublabel="Draw"
                      value={match.odds.draw}
                      selected={isSelected(match.id, 'h2h', 'Draw')}
                      onClick={() => addSelection({
                        matchId: match.id,
                        matchName: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                        marketKey: 'h2h',
                        marketName: 'Match Winner',
                        outcomeName: 'Draw',
                        price: match.odds.draw!,
                        matchSlug: matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name),
                      })}
                    />
                  ) : <div />}
                  <OddsButton
                    label="2"
                    sublabel={match.awayTeam.name.split(' ')[0]}
                    value={match.odds.away}
                    selected={isSelected(match.id, 'h2h', match.awayTeam.name)}
                    onClick={() => addSelection({
                      matchId: match.id,
                      matchName: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                      marketKey: 'h2h',
                      marketName: 'Match Winner',
                      outcomeName: match.awayTeam.name,
                      price: match.odds.away,
                      matchSlug: matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name),
                    })}
                  />
                </div>
                <OddsProbBar home={match.odds.home} draw={match.odds.draw} away={match.odds.away} />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[9px] text-white/30">
                    {match.oddsIsComputed ? '📊 Estimated odds' : `Odds • ${match.odds.bookmaker || 'Market'}`}
                  </p>
                  {!hasRealOdds && <Badge variant="outline" className="text-[8px] border-white/20 text-white/30 py-0 h-3">Estimated</Badge>}
                </div>
              </div>
            </div>
          )}

          {(lineups?.home || lineups?.away) && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-border/60 bg-card p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider">Lineups & Formation</h3>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setActiveTab('lineups')}>
                    Open
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineups.home && (
                    <div className="rounded-md bg-muted/30 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold truncate">{match.homeTeam.name}</span>
                        {lineups.home.formation && <span className="text-[10px] text-muted-foreground">{lineups.home.formation}</span>}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground truncate">
                        {lineups.home.starting.slice(0, 4).map(p => p.name).join(' • ')}
                      </p>
                    </div>
                  )}
                  {lineups.away && (
                    <div className="rounded-md bg-muted/30 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold truncate">{match.awayTeam.name}</span>
                        {lineups.away.formation && <span className="text-[10px] text-muted-foreground">{lineups.away.formation}</span>}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground truncate">
                        {lineups.away.starting.slice(0, 4).map(p => p.name).join(' • ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Venue strip */}
          {(match.venue || match.broadcasts?.length || match.attendance) && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 pb-3 text-[10px] text-white/40">
              {match.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />{match.venue}{match.venueCity ? `, ${match.venueCity}` : ''}
                </span>
              )}
              {match.attendance ? <span>👥 {match.attendance.toLocaleString()}</span> : null}
              {match.broadcasts && match.broadcasts.length > 0 && (
                <span className="flex items-center gap-1">
                  <Tv className="h-2.5 w-2.5" />{match.broadcasts.slice(0, 3).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── SPORT-SPECIFIC SCORE BREAKDOWN ───
            Quarter / inning / set / round grids. Only renders when ESPN
            actually returned linescores (i.e. live or finished games). For
            soccer we skip — there are no meaningful periods beyond HT/FT
            which the hero already shows. */}
        {segmentBreakdown && sport !== 'soccer' && segmentBreakdown.labels.length > 0 && (
          <div className="mb-4">
            <SegmentBreakdownGrid
              data={segmentBreakdown}
              homeName={match.homeTeam.name}
              awayName={match.awayTeam.name}
              homeLogo={match.homeTeam.logo}
              awayLogo={match.awayTeam.logo}
            />
          </div>
        )}

        {/* ─── PROMINENT "ADD TIP" CTA — hidden for finished matches ─── */}
        {!isFinished && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold leading-tight">
                  {tips.length > 0
                    ? `${tips.length} tipster${tips.length === 1 ? '' : 's'} have already posted`
                    : 'Be the first to post a tip on this match'}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Pick from 25+ markets — 1X2, Asian Handicap, BTTS, Over/Under, HT/FT…
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] bg-amber-500 text-amber-950 hover:bg-amber-400 font-bold shadow-sm"
              onClick={() => setTipModalOpen(true)}
            >
              <Star className="h-3 w-3" />
              Add Tip
            </Button>
          </div>
        )}

        {/* ─── TABS — 5 tabs: Tips | Match | Analysis | Table | News ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-8 flex gap-0.5 bg-muted/60 p-0.5 rounded-lg mb-2">
            <TabsTrigger value="tips" className="flex-1 px-1 py-0 h-full text-[10px] md:text-xs font-bold rounded-md relative data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 data-[state=active]:shadow">
              Tips
              {tips.length > 0 && (
                <span className="ml-0.5 rounded-full bg-white/30 data-[state=active]:bg-amber-950/20 px-1 text-[8px] font-black leading-3">{tips.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex-1 px-1 py-0 h-full text-[10px] md:text-xs font-bold rounded-md relative data-[state=active]:shadow">
              Match
              {isLive && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-1 px-1 py-0 h-full text-[10px] md:text-xs font-bold rounded-md relative data-[state=active]:shadow">
              Analysis
              {hasTeamStats && isLive && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="standings" className="flex-1 px-1 py-0 h-full text-[10px] md:text-xs font-bold rounded-md data-[state=active]:shadow">Table</TabsTrigger>
            <TabsTrigger value="news" className="flex-1 px-1 py-0 h-full text-[10px] md:text-xs font-bold rounded-md data-[state=active]:shadow">News</TabsTrigger>
          </TabsList>

          {/* ══ OVERVIEW ══ */}
          <TabsContent value="overview" className="mt-0 space-y-4">
            {/* Fan poll: who will win? (works for logged-in & guest users) */}
            <WinnerVote
              matchId={match.id}
              homeName={match.homeTeam.name}
              awayName={match.awayTeam.name}
              homeLogo={match.homeTeam.logo}
              awayLogo={match.awayTeam.logo}
              allowDraw={!NO_DRAW_SPORTS.has(sport)}
              matchStatus={match.status}
              kickoffTime={match.kickoffTime}
            />

            {/* AI Auto-Prediction */}
            <AIMatchPrediction
              homeTeam={match.homeTeam.name}
              awayTeam={match.awayTeam.name}
              sportSlug={sport}
              odds={match.odds || null}
              homeForm={match.homeTeam.form}
              awayForm={match.awayTeam.form}
              h2h={data.h2h}
            />

            {/* Match Facts — trends from form + H2H (like OddsPortal Match Facts) */}
            <MatchFacts
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              h2h={data.h2h as unknown as Parameters<typeof MatchFacts>[0]['h2h']}
            />

            {/* AI Multi-Market Predictions */}
            <AIMultiMarket
              homeTeam={match.homeTeam.name}
              awayTeam={match.awayTeam.name}
              sportSlug={sport}
              odds={match.odds || null}
              homeForm={match.homeTeam.form}
              awayForm={match.awayTeam.form}
              h2h={data.h2h}
              markets={match.markets || null}
              homeScore={match.homeScore}
              awayScore={match.awayScore}
              status={match.status}
              lineups={data.lineups ? {
                home: { starters: data.lineups.home?.starting?.length || 0, injuries: 0 },
                away: { starters: data.lineups.away?.starting?.length || 0, injuries: 0 },
              } : null}
            />

            {/* Tips Preview */}
            {tips.length > 0 && (
              <Card className="overflow-hidden border-amber-500/20">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-gradient-to-r from-amber-500/10 to-transparent">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    Expert Tips
                    <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">{tips.length} predictions</Badge>
                  </h3>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-amber-600 hover:text-amber-700" onClick={() => setActiveTab('tips')}>
                    View all <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
                <CardContent className="p-3 space-y-2">
                  {tips.slice(0, 2).map((tip, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {tip.tipster.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold">{tip.tipster.displayName}</span>
                          {tip.tipster.isPremium && <Badge className="h-4 text-[9px] bg-amber-500/20 text-amber-600 border-0">PRO</Badge>}
                          <span className="text-[10px] text-muted-foreground">• {tip.tipster.winRate}% win rate</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-primary">{tip.prediction}</span>
                          <span className="text-xs text-muted-foreground">@ {tip.odds.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-emerald-500">{tip.confidence}%</div>
                        <div className="text-[9px] text-muted-foreground">confident</div>
                      </div>
                    </div>
                  ))}
                  {tips.length > 2 && (
                    <button onClick={() => setActiveTab('tips')} className="w-full py-2 text-xs text-amber-600 hover:text-amber-700 font-medium text-center rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                      +{tips.length - 2} more tips →
                    </button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Match Events — full timeline inline in Match tab */}
            {matchEvents.length > 0 && (
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-border/40">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold flex-1">Match Events</h3>
                  {isLive && <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
                </div>
                <CardContent className="px-4 pb-4 pt-3">
                  <div className="mb-2 grid grid-cols-3 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    <span className="text-right">{match.homeTeam.name}</span>
                    <span className="text-center">Min</span>
                    <span>{match.awayTeam.name}</span>
                  </div>
                  <EventsTimeline
                    events={matchEvents}
                    homeName={match.homeTeam.name}
                    awayName={match.awayTeam.name}
                  />
                </CardContent>
              </Card>
            )}

            {/* Top Performers */}
            {leaders.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Award className="h-4 w-4 text-amber-500" />Top Performers
                  </h3>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {leaders.slice(0, 6).map((l, i) => {
                      const Wrapper: React.ElementType = l.athleteId ? Link : 'div'
                      const wrapperProps = l.athleteId
                        ? { href: playerHref(l.athlete, l.athleteId) }
                        : {}
                      return (
                        <Wrapper
                          key={i}
                          {...(wrapperProps as Record<string, unknown>)}
                          className={cn(
                            'group flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 p-3 transition-colors',
                            l.athleteId && 'hover:border-primary/40 hover:bg-primary/5 cursor-pointer',
                          )}
                        >
                          <PlayerAvatar
                            id={l.athleteId}
                            name={l.athlete}
                            headshot={l.headshot}
                            size="md"
                            ring="border"
                            noLink
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              'truncate text-sm font-semibold',
                              l.athleteId && 'group-hover:text-primary',
                            )}>{l.athlete}</p>
                            <p className="truncate text-xs text-muted-foreground">{l.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-primary">{l.value}</p>
                          </div>
                        </Wrapper>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <TrendingUp className="h-4 w-4 text-primary" />Recent Form
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { team: match.homeTeam, label: 'Home' },
                    { team: match.awayTeam, label: 'Away' },
                  ].map(({ team, label }) => {
                    const teamLink = team.espnTeamId ? teamHref(team.name, team.espnTeamId) : null
                    const TeamWrapper: React.ElementType = teamLink ? Link : 'div'
                    const wrapperProps = teamLink ? { href: teamLink } : {}
                    return (
                      <div key={label}>
                        <TeamWrapper
                          {...(wrapperProps as Record<string, unknown>)}
                          className={cn(
                            'mb-2 flex items-center gap-2 rounded-lg -mx-1 px-1 py-0.5 transition-colors',
                            teamLink && 'hover:bg-muted/50 cursor-pointer group',
                          )}
                        >
                          <TeamLogo teamName={team.name} logoUrl={team.logo} size="sm" />
                          <span className={cn(
                            'truncate text-sm font-semibold',
                            teamLink && 'group-hover:text-primary group-hover:underline underline-offset-2',
                          )}>{team.name}</span>
                          {team.record && (
                            <span className="ml-auto text-[10px] font-mono text-muted-foreground shrink-0">{team.record}</span>
                          )}
                        </TeamWrapper>
                        {team.form ? (
                          <div className="flex flex-wrap gap-1">
                            {team.form.split('').map((r, i) => <FormBadge key={i} result={r} />)}
                          </div>
                        ) : <p className="text-xs text-muted-foreground">No form data</p>}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* H2H quick */}
            {h2h && h2h.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Users className="h-4 w-4 text-primary" />Head to Head
                    </h3>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setActiveTab('stats')}>View all</Button>
                  </div>
                  <div className="space-y-2">
                    {h2h.slice(0, 3).map((g, i) => (
                      <H2HRow key={i} game={g} timezone={timezone} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming matches in this league */}
            {match.league?.name && (
              <UpcomingMatchesPanel
                leagueName={match.league.name}
                excludeMatchId={match.id}
              />
            )}

            {/* News */}
            {news.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Newspaper className="h-4 w-4 text-primary" />Latest News
                    </h3>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setActiveTab('news')}>View all</Button>
                  </div>
                  <div className="space-y-2">
                    {news.slice(0, 2).map((n, i) => <NewsRow key={i} item={n} />)}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ TIPS ══ */}
          <TabsContent value="tips" className="mt-0 space-y-4">
            {/* Top "Add a Tip" CTA inside the Tips tab — hidden for finished matches */}
            {!isFinished ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">Got a strong read on this game?</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Pick a market, post your prediction with the real odds, share with the community.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400 font-bold shrink-0"
                  onClick={() => setTipModalOpen(true)}
                >
                  <Star className="h-3.5 w-3.5" />
                  Add Tip
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                This match has finished. Tips posted before kick-off are shown below.
              </div>
            )}

            {/* Tips Header Stats */}
            {tips.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/40 bg-card p-3 text-center">
                  <div className="text-2xl font-black text-foreground">{tips.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Total Tips</div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <div className="text-2xl font-black text-emerald-500">
                    {Math.round(tips.reduce((s, t) => s + t.confidence, 0) / tips.length)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Avg Confidence</div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <div className="text-2xl font-black text-amber-500">
                    {(tips.reduce((s, t) => s + t.odds, 0) / tips.length).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Avg Odds</div>
                </div>
              </div>
            )}

            {/* Tips List */}
            {tips.length > 0 ? (
              <div className="space-y-3">
                {tips.map((tip) => (
                  <TipCard key={tip.id} tip={tip} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Star className="h-12 w-12 mx-auto mb-3 text-amber-400/30" />
                  <p className="font-semibold text-lg">No tips yet for this match</p>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {isAuthenticated ? "Be the first tipster — use the form below." : "Sign in to be the first tipster on this match."}
                  </p>
                  {!isAuthenticated && !authLoading && (
                    <Button asChild className="mt-5">
                      <Link href={`/login?redirect=/matches/${encodeURIComponent(id)}`}>Sign in to add a tip</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recently posted toast */}
            {tipSubmitted && (
              <Card className="border-emerald-500/40 bg-emerald-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">Tip posted!</p>
                    <p className="text-xs text-muted-foreground">
                      {tipSubmitted.label} @ <span className="font-mono font-bold text-emerald-500">{tipSubmitted.odds.toFixed(2)}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setTipSubmitted(null); setTipModalOpen(true) }}>Add another</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ EVENTS ══ */}
          <TabsContent value="events" className="mt-0">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 grid grid-cols-3 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  <span className="text-right">{match.homeTeam.name}</span>
                  <span className="text-center">Min</span>
                  <span>{match.awayTeam.name}</span>
                </div>
                <EventsTimeline events={matchEvents} homeName={match.homeTeam.name} awayName={match.awayTeam.name} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ STATS ══ */}
          <TabsContent value="stats" className="mt-0 space-y-4">
            <TeamStatsTab
              teamStats={teamStats}
              homeName={match.homeTeam.name}
              awayName={match.awayTeam.name}
              homeLogo={match.homeTeam.logo}
              awayLogo={match.awayTeam.logo}
              homeTeamId={match.homeTeam.espnTeamId}
              awayTeamId={match.awayTeam.espnTeamId}
              isLive={isLive}
              isFinished={isFinished}
            />
            {/* H2H merged into Analysis tab */}
            {h2h && h2h.length > 0 && (
              <div className="space-y-3">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />Head to Head — Last {h2h.length} meetings
                    </h3>
                    <H2HSummaryBar games={h2h} homeName={match.homeTeam.name} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {h2h.map((g, i) => <H2HRow key={i} game={g} timezone={timezone} homeName={match.homeTeam.name} />)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ══ ODDS ══ */}
          <TabsContent value="odds" className="mt-0 space-y-3">
            {/* Summary odds card — compact */}
            {match.odds && (
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wide">Match Result (1X2)</h3>
                  {match.oddsIsComputed && (
                    <Badge variant="outline" className="text-[9px] ml-auto">Estimated</Badge>
                  )}
                </div>
                <CardContent className="p-3 space-y-2.5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <OddsCardLarge label="1 Home" sublabel={match.homeTeam.name} value={match.odds.home} />
                    {match.odds.draw !== undefined
                      ? <OddsCardLarge label="X Draw" sublabel="Draw" value={match.odds.draw} highlight />
                      : <div />}
                    <OddsCardLarge label="2 Away" sublabel={match.awayTeam.name} value={match.odds.away} />
                  </div>
                  <div>
                    <OddsProbBar home={match.odds.home} draw={match.odds.draw} away={match.odds.away} />
                    <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                      <span className="truncate max-w-[35%]">{match.homeTeam.name}</span>
                      {match.odds.draw !== undefined && <span>Draw</span>}
                      <span className="truncate max-w-[35%] text-right">{match.awayTeam.name}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bookmaker comparison */}
            {bookmakerOdds.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide">Bookmaker Comparison</h3>
                </div>
                <CardContent className="p-0">
                  <div className="overflow-x-auto md:block hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40 text-[10px] uppercase text-muted-foreground bg-muted/30">
                          <th className="px-3 py-2 text-left">Bookmaker</th>
                          <th className="px-3 py-2 text-center">1</th>
                          {bookmakerOdds.some(o => o.draw !== undefined) && <th className="px-3 py-2 text-center">X</th>}
                          <th className="px-3 py-2 text-center">2</th>
                          {bookmakerOdds.some(o => o.links?.home || o.links?.away || o.links?.draw) && (
                            <th className="px-3 py-2 text-right">Bet</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {bookmakerOdds.map((o, i) => {
                          const best1 = Math.max(...bookmakerOdds.map(x => x.home))
                          const bestX = Math.max(...bookmakerOdds.map(x => x.draw ?? 0))
                          const best2 = Math.max(...bookmakerOdds.map(x => x.away))
                          const anyLinks = bookmakerOdds.some(x => x.links?.home || x.links?.away || x.links?.draw)
                          // Pick the most useful single deeplink for the row's
                          // "Bet now" button — prefer the side that's also the
                          // best price for that bookmaker, otherwise fall back
                          // to whichever link exists.
                          const link = o.links?.home || o.links?.away || o.links?.draw
                          return (
                            <tr key={i} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-1.5 font-semibold text-xs">{o.bookmaker}</td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={cn("font-mono font-bold text-xs", o.home === best1 ? "text-emerald-500" : "text-foreground")}>
                                  {o.home.toFixed(2)}
                                </span>
                              </td>
                              {bookmakerOdds.some(x => x.draw !== undefined) && (
                                <td className="px-3 py-1.5 text-center">
                                  {o.draw !== undefined ? (
                                    <span className={cn("font-mono font-bold text-xs", o.draw === bestX ? "text-emerald-500" : "text-foreground")}>
                                      {o.draw.toFixed(2)}
                                    </span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </td>
                              )}
                              <td className="px-3 py-1.5 text-center">
                                <span className={cn("font-mono font-bold text-xs", o.away === best2 ? "text-emerald-500" : "text-foreground")}>
                                  {o.away.toFixed(2)}
                                </span>
                              </td>
                              {anyLinks && (
                                <td className="px-3 py-1.5 text-right">
                                  {link ? (
                                    <a
                                      href={link}
                                      target="_blank"
                                      rel="nofollow noopener sponsored"
                                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-semibold px-2 py-0.5 transition-colors"
                                    >
                                      Bet →
                                    </a>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2 p-3 md:hidden">
                    {bookmakerOdds.map((o, i) => {
                      const best1 = Math.max(...bookmakerOdds.map(x => x.home))
                      const bestX = Math.max(...bookmakerOdds.map(x => x.draw ?? 0))
                      const best2 = Math.max(...bookmakerOdds.map(x => x.away))
                      const anyLinks = bookmakerOdds.some(x => x.links?.home || x.links?.away || x.links?.draw)
                      const link = o.links?.home || o.links?.away || o.links?.draw
                      return (
                        <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{o.bookmaker}</span>
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="nofollow noopener sponsored"
                                className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500"
                              >
                                Bet
                              </a>
                            )}
                          </div>
                          <div className={cn('grid gap-2', o.draw !== undefined ? 'grid-cols-3' : 'grid-cols-2')}>
                            <div className={cn('rounded-md bg-background px-2 py-1 text-center', o.home === best1 && 'text-emerald-500')}>
                              <div className="text-[9px] uppercase text-muted-foreground">1</div>
                              <div className="font-mono text-sm font-bold">{o.home.toFixed(2)}</div>
                            </div>
                            {o.draw !== undefined && (
                              <div className={cn('rounded-md bg-background px-2 py-1 text-center', o.draw === bestX && 'text-emerald-500')}>
                                <div className="text-[9px] uppercase text-muted-foreground">X</div>
                                <div className="font-mono text-sm font-bold">{o.draw.toFixed(2)}</div>
                              </div>
                            )}
                            <div className={cn('rounded-md bg-background px-2 py-1 text-center', o.away === best2 && 'text-emerald-500')}>
                              <div className="text-[9px] uppercase text-muted-foreground">2</div>
                              <div className="font-mono text-sm font-bold">{o.away.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="px-4 py-2 text-[10px] text-muted-foreground">
                    Best odds highlighted in green. Affiliate-style links open the bookmaker’s bet slip in a new tab.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Spreads / Totals */}
            {bookmakerOdds.some(o => o.spread || o.total) && (
              <div className="grid gap-4 md:grid-cols-2">
                {bookmakerOdds.some(o => o.spread) && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="mb-3 text-sm font-bold flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />Handicap / Spread
                      </h4>
                      <div className="space-y-2">
                        {bookmakerOdds.filter(o => o.spread).map((o, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                            <span className="font-medium text-muted-foreground">{o.bookmaker}</span>
                            <div className="flex gap-3 font-mono text-sm">
                              <span>{o.spread!.value > 0 ? '+' : ''}{o.spread!.value}</span>
                              <span className="font-bold text-primary">{o.spread!.homePrice.toFixed(2)}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="font-bold text-primary">{o.spread!.awayPrice.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {bookmakerOdds.some(o => o.total) && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="mb-3 text-sm font-bold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />Over / Under
                      </h4>
                      <div className="space-y-2">
                        {bookmakerOdds.filter(o => o.total).map((o, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                            <span className="font-medium text-muted-foreground">{o.bookmaker} ({o.total!.value})</span>
                            <div className="flex gap-3 font-mono text-sm">
                              <span>O <span className="font-bold text-emerald-500">{o.total!.overPrice.toFixed(2)}</span></span>
                              <span>U <span className="font-bold text-rose-500">{o.total!.underPrice.toFixed(2)}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* All other markets — BTTS, Totals, Double Chance, Half-time, etc. */}
            {match.markets && match.markets.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {match.markets
                  .filter((m) => m.key !== 'h2h' && m.outcomes && m.outcomes.length > 0)
                  .map((mkt) => (
                    <Card key={mkt.key}>
                      <CardContent className="p-4">
                        <h4 className="mb-3 text-sm font-bold flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          {mkt.name}
                        </h4>
                        <div className="grid gap-2" style={{
                          gridTemplateColumns: `repeat(${Math.min(mkt.outcomes.length, 3)}, minmax(0,1fr))`,
                        }}>
                          {mkt.outcomes.map((o, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5 text-center hover:bg-muted/60 transition-colors"
                            >
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                                {o.name}
                                {o.point !== undefined ? ` ${o.point}` : ''}
                              </p>
                              <p className="text-base font-black text-foreground mt-0.5 font-mono tabular-nums">
                                {o.price.toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}

            {bookmakerOdds.length === 0 && !match.odds && (!match.markets || match.markets.length === 0) && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No odds available</p>
                  <p className="text-sm mt-1">Odds will appear once published by bookmakers.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ LINEUPS ══ */}
          <TabsContent value="lineups" className="mt-0 space-y-4">
            {lineups && (lineups.home || lineups.away) ? (
              <>
                {/* Lineup status badge */}
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "gap-1.5 px-3 py-1",
                    data?.hasLineups
                      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  )}>
                    {data?.hasLineups ? (
                      <><CheckCircle2 className="h-3 w-3" />Confirmed Lineup</>
                    ) : (
                      <><AlertTriangle className="h-3 w-3" />Predicted Lineup — Official lineup not yet announced</>
                    )}
                  </Badge>
                </div>

                {/* Formation Pitch — only meaningful for football/soccer
                    where players occupy formation positions on a pitch. For
                    other sports (basketball, baseball, hockey, american
                    football, etc.) the squad list is the right primary view
                    and the pitch graphic is misleading. */}
                {(sport === 'soccer' || sport === 'football' || sport === 'rugby') && (
                  <Card className="overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-border/50">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        <Shirt className="h-4 w-4 text-primary" />
                        {data?.hasLineups ? 'Confirmed Formation' : 'Predicted Formation'}
                        {lineups.home?.formation && <span className="text-muted-foreground font-normal text-xs">({match.homeTeam.name}: {lineups.home.formation})</span>}
                        {lineups.away?.formation && <span className="text-muted-foreground font-normal text-xs">({match.awayTeam.name}: {lineups.away.formation})</span>}
                      </h3>
                    </div>
                    <CardContent className="p-4">
                      <FormationPitch home={lineups.home} away={lineups.away} />
                    </CardContent>
                  </Card>
                )}

                {/* Squad lists — shown for every sport. */}
                <div className="grid gap-4 md:grid-cols-2">
                  {lineups.home && <RosterCard side="Home" roster={lineups.home} isConfirmed={!!data?.hasLineups} />}
                  {lineups.away && <RosterCard side="Away" roster={lineups.away} isConfirmed={!!data?.hasLineups} />}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-14 text-center text-muted-foreground">
                  <Shirt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-base">Lineup not announced yet</p>
                  <p className="text-sm mt-1">Squad lists are usually confirmed 1 hour before kickoff.</p>
                  <Badge variant="outline" className="mt-3 text-amber-500 border-amber-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />Expected 1h before kickoff
                  </Badge>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ H2H ══ */}
          <TabsContent value="h2h" className="mt-0">
            {h2h && h2h.length > 0 ? (
              <div className="space-y-3">
                {/* Summary bar */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />Head to Head — Last {h2h.length} meetings
                    </h3>
                    <H2HSummaryBar games={h2h} homeName={match.homeTeam.name} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {h2h.map((g, i) => <H2HRow key={i} game={g} timezone={timezone} homeName={match.homeTeam.name} />)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-14 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No previous meetings</p>
                  <p className="text-sm mt-1">No head-to-head history available.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ STANDINGS ══ */}
          <TabsContent value="standings" className="mt-0 space-y-4">
            {standings && standings.length > 0 ? (
              standings.map((g, i) => {
                const hasGoals = g.rows.some(r => r.goalsFor !== undefined)
                const totalRows = g.rows.length
                const fullTableHref = match.homeTeam.leagueSlug
                  ? `/leagues/${match.homeTeam.leagueSlug}`
                  : match.league?.slug
                  ? `/leagues/${match.league.slug}`
                  : null
                return (
                  <Card key={i} className="overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-border/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-warning" />
                        <h3 className="text-sm font-bold">{g.header || 'League Table'}</h3>
                      </div>
                      {fullTableHref && (
                        <Link
                          href={fullTableHref}
                          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View full table <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="pb-2 pr-2 text-left font-medium">#</th>
                              <th className="pb-2 text-left font-medium">Team</th>
                              <th className="pb-2 text-center font-medium">P</th>
                              <th className="pb-2 text-center font-medium">W</th>
                              <th className="pb-2 text-center font-medium">D</th>
                              <th className="pb-2 text-center font-medium">L</th>
                              {hasGoals && <th className="pb-2 text-center font-medium">GF</th>}
                              {hasGoals && <th className="pb-2 text-center font-medium">GA</th>}
                              {hasGoals && <th className="pb-2 text-center font-medium">GD</th>}
                              <th className="pb-2 pl-2 text-center font-medium">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((r, ri) => {
                              const position = r.position ?? ri + 1
                              const isCurrent = r.teamName === match.homeTeam.name || r.teamName === match.awayTeam.name
                              const isTop = position <= 4
                              const isBottom = position >= totalRows - 2
                              const gd = r.goalDifference
                              return (
                                <tr
                                  key={ri}
                                  className={cn(
                                    "border-b transition-colors hover:bg-muted/50",
                                    isTop && "bg-success/5",
                                    isBottom && "bg-destructive/5",
                                    isCurrent && "bg-primary/10 font-semibold",
                                  )}
                                >
                                  <td className="py-2 pr-2">
                                    <span
                                      className={cn(
                                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                        isTop && "bg-success text-success-foreground",
                                        isBottom && "bg-destructive text-destructive-foreground",
                                        !isTop && !isBottom && "text-muted-foreground",
                                      )}
                                    >
                                      {position}
                                    </span>
                                  </td>
                                  <td className="py-2">
                                    {r.teamId ? (
                                      <Link
                                        href={teamHref(r.teamName, r.teamId)}
                                        className="group flex items-center gap-2 hover:text-primary"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <TeamLogo teamName={r.teamName || ''} logoUrl={r.teamLogo} size="xs" />
                                        <span className={cn(
                                          "truncate font-medium group-hover:underline",
                                          isCurrent && "text-primary",
                                        )}>{r.teamName}</span>
                                      </Link>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <TeamLogo teamName={r.teamName || ''} logoUrl={r.teamLogo} size="xs" />
                                        <span className={cn("truncate font-medium", isCurrent && "text-primary")}>
                                          {r.teamName}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">{r.played}</td>
                                  <td className="py-2 text-center text-success">{r.won}</td>
                                  <td className="py-2 text-center">{r.drawn}</td>
                                  <td className="py-2 text-center text-destructive">{r.lost}</td>
                                  {hasGoals && <td className="py-2 text-center">{r.goalsFor ?? '—'}</td>}
                                  {hasGoals && <td className="py-2 text-center">{r.goalsAgainst ?? '—'}</td>}
                                  {hasGoals && (
                                    <td className="py-2 text-center font-medium">
                                      {gd !== undefined ? (
                                        <span className={cn(
                                          gd > 0 && "text-success",
                                          gd < 0 && "text-destructive",
                                        )}>
                                          {gd > 0 ? `+${gd}` : gd}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  )}
                                  <td className="py-2 pl-2 text-center font-bold">{r.points}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <Card>
                <CardContent className="py-14 text-center text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No standings available</p>
                  <p className="text-sm mt-1">Table data isn&apos;t published for this competition.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ NEWS ══ */}
          <TabsContent value="news" className="mt-0">
            <Card>
              <CardContent className="p-4">
                {news.length > 0 ? (
                  <div className="space-y-3">
                    {news.map((n, i) => <NewsRow key={i} item={n} />)}
                  </div>
                ) : (
                  <div className="py-14 text-center text-muted-foreground">
                    <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No news yet</p>
                    <p className="text-sm mt-1">No articles available for this match.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </div>

          {/* ─── RIGHT RAIL (xl+) ─── */}
          <aside className="hidden xl:block">
            <div className="sticky top-4 space-y-4">
              <MatchInfoRail
                match={match!}
                bookmakerOdds={bookmakerOdds}
                hasRealOdds={hasRealOdds}
                standings={standings ?? []}
                h2h={h2h ?? []}
                onJumpToTab={setActiveTab}
              />
            </div>
          </aside>
        </div>

        {/* ─── Add-Tip MODAL — opened from any "Add a Tip" button on this page.
            Sign-in prompt is at the TOP so logged-out users never miss it. ─── */}
        <Dialog open={tipModalOpen} onOpenChange={setTipModalOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Add your tip
              </DialogTitle>
              <DialogDescription className="text-xs">
                {match.homeTeam.name} vs {match.awayTeam.name} — pick a market and post your prediction.
              </DialogDescription>
            </DialogHeader>

            {!isAuthenticated ? (
              <div className="space-y-3">
                <div className="rounded-lg border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center">
                  <Star className="mx-auto h-8 w-8 fill-amber-400/30 text-amber-400 mb-2" />
                  <p className="font-bold text-sm">Sign in to share your tip</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Track your record, build a following, climb the leaderboard.
                  </p>
                  <div className="mt-3 flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={() => { setTipModalOpen(false); openAuthModal('login') }}>
                      Sign in
                    </Button>
                    <Button size="sm" onClick={() => { setTipModalOpen(false); openAuthModal('register') }}>
                      Create account
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <AddTipForm
                matchId={match.id}
                homeTeam={match.homeTeam.name}
                awayTeam={match.awayTeam.name}
                odds={match.odds}
                markets={match.markets}
                isPremiumUser={user?.role === 'admin' || user?.role === 'tipster'}
                onSubmit={async (formData) => {
                  try {
                    const res = await fetch(`/api/matches/${encodeURIComponent(match.id)}/tips`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...formData,
                        homeTeam: match.homeTeam.name,
                        awayTeam: match.awayTeam.name,
                      }),
                    })
                    if (res.ok) {
                      setTipSubmitted({ label: formData.predictionLabel, odds: formData.odds })
                      setTipModalOpen(false)
                      setActiveTab('tips')
                    }
                  } catch (err) {
                    console.error('Failed to post tip', err)
                  }
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </div>
  )
}

// ===== Upcoming matches in the same league =====

function UpcomingMatchesPanel({
  leagueName,
  excludeMatchId,
}: {
  leagueName: string
  excludeMatchId: string
}) {
  const { matches, isLoading } = useMatches()
  const timezone = getBrowserTimezone()
  const now = Date.now()

  const upcoming = (matches || [])
    .filter((m) =>
      m.id !== excludeMatchId &&
      (m.league?.name === leagueName || (m as { league?: { name?: string } }).league?.name === leagueName) &&
      new Date(m.kickoffTime).getTime() > now &&
      m.status !== 'finished' && m.status !== 'live'
    )
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
    .slice(0, 5)

  if (isLoading || upcoming.length === 0) return null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Calendar className="h-4 w-4 text-primary" />
            Upcoming in {leagueName}
          </h3>
          <Button asChild variant="ghost" size="sm" className="text-xs h-7">
            <Link href="/matches">All matches</Link>
          </Button>
        </div>
        <div className="space-y-2">
          {upcoming.map((m) => {
            const mAny = m as unknown as {
              id: string
              homeTeam: { name: string; logo?: string }
              awayTeam: { name: string; logo?: string }
              kickoffTime: string
            }
            return (
              <Link
                key={mAny.id}
                href={`/matches/${matchIdToSlug(mAny.id)}`}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                  <span className="text-xs font-semibold truncate">{mAny.homeTeam.name}</span>
                  <TeamLogo teamName={mAny.homeTeam.name} logoUrl={mAny.homeTeam.logo} size="sm" />
                </div>
                <div className="flex flex-col items-center min-w-[64px]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {getDayLabel(mAny.kickoffTime, timezone)}
                  </span>
                  <span className="text-xs font-mono">{formatTime(mAny.kickoffTime, timezone)}</span>
                </div>
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <TeamLogo teamName={mAny.awayTeam.name} logoUrl={mAny.awayTeam.logo} size="sm" />
                  <span className="text-xs font-semibold truncate">{mAny.awayTeam.name}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Betting Markets Section (used inside MatchInfoRail) =====

const MARKET_GROUP_ORDER = [
  { key: 'totals',          label: 'Total Goals/Points' },
  { key: 'totals_2_5',      label: 'Over/Under 2.5' },
  { key: 'btts',            label: 'Both Teams to Score' },
  { key: 'double_chance',   label: 'Double Chance' },
  { key: 'draw_no_bet',     label: 'Draw No Bet' },
  { key: 'spreads',         label: 'Handicap' },
  { key: 'asian_handicap',  label: 'Asian Handicap' },
  { key: 'ht_result',       label: 'Half-Time Result' },
  { key: 'ht_ft',           label: 'HT / Full-Time' },
  { key: 'btts_and_result', label: 'BTTS & Result' },
  { key: 'totals_0_5',      label: 'Over/Under 0.5' },
  { key: 'totals_1_5',      label: 'Over/Under 1.5' },
  { key: 'totals_3_5',      label: 'Over/Under 3.5' },
  { key: 'totals_4_5',      label: 'Over/Under 4.5' },
  { key: 'odd_even_goals',  label: 'Odd/Even Goals' },
  { key: 'exact_goals',     label: 'Exact Goals' },
  { key: 'correct_score',   label: 'Correct Score' },
  { key: 'first_team_to_score', label: 'First Team to Score' },
  { key: 'goal_first_half', label: 'Goal in 1st Half' },
  { key: 'win_to_nil',      label: 'Win to Nil' },
  { key: 'clean_sheet_home', label: 'Home Clean Sheet' },
  { key: 'clean_sheet_away', label: 'Away Clean Sheet' },
  { key: 'corners_8_5',     label: 'Total Corners O/U 8.5' },
  { key: 'corners_9_5',     label: 'Total Corners O/U 9.5' },
  { key: 'corners_10_5',    label: 'Total Corners O/U 10.5' },
  { key: 'corners_11_5',    label: 'Total Corners O/U 11.5' },
]

function MarketsSection({ match }: { match: MatchDetails['match'] }) {
  const { addSelection, isSelected } = useBetSlip()
  const [expanded, setExpanded] = useState(false)

  if (!match.markets || match.markets.length === 0) return null

  // Order markets according to priority list, then append any remaining ones
  const priorityKeys = MARKET_GROUP_ORDER.map(g => g.key)
  const ordered = [
    ...priorityKeys.map(k => match.markets!.find(m => m.key === k)).filter(Boolean),
    ...match.markets.filter(m => !priorityKeys.includes(m.key) && m.key !== 'h2h'),
  ] as NonNullable<typeof match.markets>

  const INITIAL_SHOW = 8
  const visibleMarkets = expanded ? ordered : ordered.slice(0, INITIAL_SHOW)
  const matchName = `${match.homeTeam.name} vs ${match.awayTeam.name}`

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Betting Markets
          <span className="ml-auto text-[10px] font-normal normal-case">Tap odds to add to slip</span>
        </h3>

        {visibleMarkets.map((mkt) => {
          const cols = mkt.outcomes.length === 2 ? 'grid-cols-2'
            : mkt.outcomes.length === 3 ? 'grid-cols-3'
            : 'grid-cols-2'
          const displayOutcomes = mkt.outcomes.slice(0, Math.min(mkt.outcomes.length, 6))

          return (
            <div key={mkt.key} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{mkt.name}</p>
              <div className={cn('grid gap-1', cols)}>
                {displayOutcomes.map((o, oi) => {
                  const selected = isSelected(match.id, mkt.key, o.name)
                  return (
                    <button
                      key={oi}
                      onClick={() => addSelection({
                        matchId: match.id,
                        matchName,
                        marketKey: mkt.key,
                        marketName: mkt.name,
                        outcomeName: o.name,
                        price: o.price,
                        matchSlug: matchToSlug(match.id, match.homeTeam.name, match.awayTeam.name),
                      })}
                      className={cn(
                        'flex flex-col items-center rounded-lg border px-1.5 py-1.5 text-center transition-all active:scale-95',
                        selected
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-muted/40 border-border/50 text-foreground hover:bg-muted/70 hover:border-primary/40',
                      )}
                    >
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">{o.name}</span>
                      <span className={cn('text-sm font-black tabular-nums mt-0.5', selected ? 'text-primary' : '')}>{o.price.toFixed(2)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {ordered.length > INITIAL_SHOW && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1 pt-1"
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Show fewer markets</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Show {ordered.length - INITIAL_SHOW} more markets</>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// ===== Right rail =====

function MatchInfoRail({
  match,
  bookmakerOdds,
  hasRealOdds,
  standings,
  h2h,
  onJumpToTab,
}: {
  match: MatchDetails['match']
  bookmakerOdds: BookmakerOdd[]
  hasRealOdds: boolean
  standings: StandingsGroup[]
  h2h: H2HGame[]
  onJumpToTab: (tab: string) => void
}) {
  const NO_DRAW = new Set(['basketball', 'baseball', 'tennis', 'mma'])
  const isTwoWay = NO_DRAW.has(match.sport.slug)
  const consensus = bookmakerOdds.length > 0 ? bookmakerOdds[0] : null
  const allRows = standings.flatMap(g => g.rows)
  // Fuzzy team-name match: ESPN's standings sometimes return a slightly
  // different display name than the scoreboard ("Man United" vs "Manchester
  // United Football Club"), which broke the strict-equality lookup and made
  // the sidebar Form widget render with a placeholder crest instead of the
  // real club logo. Normalise to lowercase alphanumerics and accept either a
  // full match or a substring match in either direction.
  const norm = (s?: string) =>
    (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const findStanding = (teamName: string) => {
    const n = norm(teamName)
    if (!n) return undefined
    return (
      allRows.find(r => norm(r.teamName) === n) ||
      allRows.find(r => {
        const rn = norm(r.teamName)
        return rn && (rn.includes(n) || n.includes(rn))
      })
    )
  }
  const homeStandingRaw = findStanding(match.homeTeam.name)
  const awayStandingRaw = findStanding(match.awayTeam.name)
  const homeStanding = homeStandingRaw
    ? { ...homeStandingRaw, teamLogo: homeStandingRaw.teamLogo || match.homeTeam.logo }
    : undefined
  const awayStanding = awayStandingRaw
    ? { ...awayStandingRaw, teamLogo: awayStandingRaw.teamLogo || match.awayTeam.logo }
    : undefined
  const last3H2H = Array.isArray(h2h) ? h2h.slice(0, 3) : []

  return (
    <>
      {/* Match info */}
      <Card>
        <CardContent className="p-4 space-y-3 text-sm">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Match Info</h3>
          {match.venue && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium truncate">{match.venue}</p>
                {match.venueCity && <p className="text-xs text-muted-foreground truncate">{match.venueCity}{match.venueCountry ? `, ${match.venueCountry}` : ''}</p>}
              </div>
            </div>
          )}
          {match.league && (
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{match.league.name}</span>
              {match.league.countryCode && (
                <FlagIcon countryCode={match.league.countryCode} size="sm" />
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs">{new Date(match.kickoffTime).toLocaleString()}</span>
          </div>
          {match.attendance && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs">{match.attendance.toLocaleString()} attendance</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Odds comparison */}
      {bookmakerOdds.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                {hasRealOdds ? 'Bookmaker Odds' : 'Estimated Odds'}
              </h3>
            </div>
            {/* Column headers */}
            <div className={cn('grid gap-1 text-[9px] font-bold uppercase text-muted-foreground px-0.5', isTwoWay ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]')}>
              <span>Book</span>
              <span className="text-center w-10">1</span>
              {!isTwoWay && <span className="text-center w-10">X</span>}
              <span className="text-center w-10">2</span>
            </div>
            {/* Up to 6 bookmakers */}
            {bookmakerOdds.slice(0, 6).map((b, i) => (
              <div key={i} className={cn(
                'grid gap-1 items-center rounded-lg px-0.5 py-1',
                isTwoWay ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]',
                i === 0 ? 'bg-primary/5' : '',
              )}>
                <span className="text-[10px] truncate text-muted-foreground">{b.bookmaker}</span>
                <span className={cn('w-10 text-center text-xs font-bold tabular-nums', i === 0 ? 'text-primary' : '')}>{b.home.toFixed(2)}</span>
                {!isTwoWay && <span className={cn('w-10 text-center text-xs font-bold tabular-nums', i === 0 ? 'text-primary' : '')}>{b.draw?.toFixed(2) ?? '—'}</span>}
                <span className={cn('w-10 text-center text-xs font-bold tabular-nums', i === 0 ? 'text-primary' : '')}>{b.away.toFixed(2)}</span>
              </div>
            ))}
            {bookmakerOdds.length === 0 && consensus && (
              <div className={cn('grid gap-1.5', isTwoWay ? 'grid-cols-2' : 'grid-cols-3')}>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">{isTwoWay ? 'Home' : '1'}</p>
                  <p className="font-bold">{consensus.home.toFixed(2)}</p>
                </div>
                {!isTwoWay && consensus.draw !== undefined && (
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">X</p>
                    <p className="font-bold">{consensus.draw.toFixed(2)}</p>
                  </div>
                )}
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">{isTwoWay ? 'Away' : '2'}</p>
                  <p className="font-bold">{consensus.away.toFixed(2)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Betting markets */}
      {match.markets && match.markets.length > 0 && (
        <MarketsSection match={match} />
      )}

      {/* Standings snapshot */}
      {(homeStanding || awayStanding) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Form</h3>
              <button
                onClick={() => onJumpToTab('standings')}
                className="text-xs text-primary hover:underline"
              >
                Table →
              </button>
            </div>
            {[homeStanding, awayStanding].filter(Boolean).map((t, i) => {
              const tHref = t!.teamId ? teamHref(t!.teamName, t!.teamId) : null
              const Wrap: React.ElementType = tHref ? Link : 'div'
              const wProps = tHref ? { href: tHref } : {}
              return (
                <Wrap
                  key={i}
                  {...(wProps as Record<string, unknown>)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 transition-colors',
                    tHref && 'hover:bg-muted/60 cursor-pointer group',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground w-5 text-right">{t!.position ?? '-'}</span>
                    <TeamLogo teamName={t!.teamName ?? ''} logoUrl={t!.teamLogo} size="sm" />
                    <span className={cn('font-medium text-xs truncate', tHref && 'group-hover:text-primary group-hover:underline')}>{t!.teamName}</span>
                  </div>
                  <span className="font-bold text-xs tabular-nums">{t!.points} pts</span>
                </Wrap>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* H2H teaser */}
      {last3H2H.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Last Meetings</h3>
              <button
                onClick={() => onJumpToTab('h2h')}
                className="text-xs text-primary hover:underline"
              >
                All →
              </button>
            </div>
            {last3H2H.map((g, i) => {
              const hs = g.home.score ?? 0
              const as_ = g.away.score ?? 0
              const detail = g.matchId ? `/matches/${matchIdToSlug(g.matchId)}` : null
              const inner = (
                <>
                  <span className="truncate flex-1 text-right font-medium">{g.home.name}</span>
                  <span className="font-mono font-bold tabular-nums px-2 py-0.5 rounded bg-muted">
                    {hs}-{as_}
                  </span>
                  <span className="truncate flex-1 font-medium">{g.away.name}</span>
                </>
              )
              if (detail) {
                return (
                  <Link
                    key={i}
                    href={detail}
                    className="flex items-center justify-between gap-2 text-xs rounded-md px-1 py-1 -mx-1 hover:bg-muted/40 transition-colors"
                  >
                    {inner}
                  </Link>
                )
              }
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-xs px-1 py-1">
                  {inner}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </>
  )
}

// ===== Sub-components =====

function OddsButton({ label, sublabel, value, onClick, selected }: { label: string; sublabel: string; value: number; onClick?: () => void; selected?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-center cursor-pointer transition-all active:scale-95",
        selected
          ? "bg-primary/25 border-primary/70"
          : "bg-white/8 border-white/15 hover:bg-white/15 hover:border-white/25",
      )}
    >
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">{label}</p>
      <p className={cn("text-xl font-black mt-0.5", selected ? "text-primary" : "text-white")}>{value.toFixed(2)}</p>
      <p className="text-[9px] text-white/30 truncate mt-0.5">{sublabel}</p>
    </div>
  )
}

function OddsCardLarge({ label, sublabel, value, highlight }: { label: string; sublabel: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border px-2 py-2 text-center transition-all hover:shadow-sm cursor-pointer",
      highlight ? "border-primary/30 bg-primary/8" : "border-border/50 bg-muted/40 hover:bg-muted/60"
    )}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn("text-xl font-black leading-none mt-0.5", highlight ? "text-primary" : "text-foreground")}>{value.toFixed(2)}</p>
      <p className="text-[9px] text-muted-foreground truncate mt-0.5">{sublabel}</p>
    </div>
  )
}

function H2HSummaryBar({ games, homeName }: { games: H2HGame[]; homeName: string }) {
  let hw = 0, draws = 0, aw = 0
  for (const g of games) {
    const hs = g.home.score ?? 0, as_ = g.away.score ?? 0
    const isHome = g.home.name === homeName
    if (hs > as_) isHome ? hw++ : aw++
    else if (as_ > hs) isHome ? aw++ : hw++
    else draws++
  }
  const total = hw + draws + aw || 1
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="text-emerald-600">{hw}W</span>
        <span className="text-muted-foreground">{draws}D</span>
        <span className="text-rose-500">{aw}W</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden">
        <div className="bg-emerald-500 transition-all" style={{ width: `${(hw / total) * 100}%` }} />
        <div className="bg-muted transition-all" style={{ width: `${(draws / total) * 100}%` }} />
        <div className="bg-rose-500 transition-all" style={{ width: `${(aw / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{homeName}</span>
        <span>Draw</span>
        <span>Opponent</span>
      </div>
    </div>
  )
}

function H2HRow({ game, timezone, homeName }: { game: H2HGame; timezone: string; homeName?: string }) {
  const [expanded, setExpanded] = useState(false)
  const hs = game.home.score ?? 0
  const as_ = game.away.score ?? 0
  const homeWon = hs > as_
  const awayWon = as_ > hs
  const isFromCurrent = game.home.name === homeName
  const detailHref = game.matchId ? `/matches/${matchIdToSlug(game.matchId)}` : null

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors text-sm overflow-hidden">
      <div className="grid w-full grid-cols-[1fr_auto_1fr_auto] items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="contents text-left"
          aria-expanded={expanded}
          aria-label="Toggle match details"
        >
          <div className="flex items-center gap-2 justify-end min-w-0">
            <span className={cn("truncate font-medium", homeWon && "font-bold text-emerald-600")}>{game.home.name}</span>
            <TeamLogo teamName={game.home.name} logoUrl={game.home.logo} size="sm" />
          </div>
          <div className="flex flex-col items-center min-w-[60px]">
            <div className="font-mono font-bold tabular-nums">
              <span className={cn(homeWon && "text-emerald-600")}>{game.home.score ?? '?'}</span>
              {' — '}
              <span className={cn(awayWon && "text-emerald-600")}>{game.away.score ?? '?'}</span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              {game.date ? formatDate(game.date, timezone, { year: true }) : ''}
              {game.league ? ` • ${game.league}` : ''}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <TeamLogo teamName={game.away.name} logoUrl={game.away.logo} size="sm" />
            <span className={cn("truncate font-medium", awayWon && "font-bold text-emerald-600")}>{game.away.name}</span>
          </div>
        </button>
        {detailHref ? (
          <Link
            href={detailHref}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Open this match's full details"
            title="Open match details"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : <div className="w-7" />}
      </div>
      {expanded && (
        <div className="border-t border-border/40 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground/70">Result:</span>{' '}
              <span className="font-semibold text-foreground">
                {homeWon ? `${game.home.name} won` : awayWon ? `${game.away.name} won` : 'Draw'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/70">Total goals:</span>{' '}
              <span className="font-semibold text-foreground">{hs + as_}</span>
            </div>
            {game.league && (
              <div className="col-span-2">
                <span className="text-muted-foreground/70">Competition:</span>{' '}
                <span className="font-medium text-foreground">{game.league}</span>
              </div>
            )}
            {game.date && (
              <div className="col-span-2">
                <span className="text-muted-foreground/70">Played:</span>{' '}
                <span className="font-medium text-foreground">{formatDate(game.date, timezone, { year: true })}</span>
              </div>
            )}
          </div>
          {!isFromCurrent && (
            <p className="pt-1 border-t border-border/30 text-[10px] italic text-muted-foreground/80">
              Reverse fixture — home/away swapped from current matchup.
            </p>
          )}
          {detailHref && (
            <div className="pt-2 border-t border-border/30">
              <Link
                href={detailHref}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                View this match&apos;s full details
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sidebar-specific pitch: always vertical (ignores md: breakpoints) ──
function SidebarPitch({ home, away }: { home: PitchData | null; away: PitchData | null }) {
  const awayColumnsTopDown = away ? [...away.columns].reverse() : []
  const homeColumnsTopDown = home?.columns ?? []
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1a5c2a 0%, #1e7a35 50%, #1a5c2a 100%)', minHeight: 420 }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 220 420" preserveAspectRatio="none">
        <rect x="6" y="6" width="208" height="408" fill="none" stroke="white" strokeWidth="1.5" />
        <line x1="6" y1="210" x2="214" y2="210" stroke="white" strokeWidth="1.5" />
        <circle cx="110" cy="210" r="38" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="110" cy="210" r="2.5" fill="white" />
        <rect x="62" y="6" width="96" height="64" fill="none" stroke="white" strokeWidth="1" />
        <rect x="86" y="6" width="48" height="30" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="110" cy="70" r="2.5" fill="white" />
        <rect x="62" y="350" width="96" height="64" fill="none" stroke="white" strokeWidth="1" />
        <rect x="86" y="384" width="48" height="30" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="110" cy="350" r="2.5" fill="white" />
      </svg>
      <div className="relative flex flex-col px-1 py-2" style={{ minHeight: 420 }}>
        {/* Home — top half */}
        <div className="flex-1 flex flex-col min-h-0">
          {home && <TeamHeader team={home.team} align="center" />}
          <div className="flex flex-1 flex-col items-stretch justify-around gap-0.5">
            {homeColumnsTopDown.map((row, ri) => (
              <div key={ri} className="flex justify-around items-center gap-0.5 px-1">
                {row.map((p, pi) => <PitchPlayer key={pi} player={p} color="bg-rose-500" />)}
              </div>
            ))}
          </div>
        </div>
        {/* Half-way divider */}
        <div className="flex items-center gap-1 py-0.5 opacity-40">
          <div className="h-px flex-1 bg-white/40" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
          <div className="h-px flex-1 bg-white/40" />
        </div>
        {/* Away — bottom half */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-1 flex-col items-stretch justify-around gap-0.5">
            {awayColumnsTopDown.map((row, ri) => (
              <div key={ri} className="flex justify-around items-center gap-0.5 px-1">
                {row.map((p, pi) => <PitchPlayer key={pi} player={p} color="bg-sky-500" />)}
              </div>
            ))}
          </div>
          {away && <TeamHeader team={away.team} align="center" />}
        </div>
      </div>
    </div>
  )
}

// ── Basketball court SVG for sidebar ──
function BasketballCourtSVG({ homeName, awayName }: { homeName: string; awayName: string }) {
  return (
    <div className="relative" style={{ background: '#8B4513', minHeight: 120 }}>
      <svg viewBox="0 0 220 130" className="w-full" style={{ display: 'block' }}>
        {/* Court surface */}
        <rect width="220" height="130" fill="#c8802a" />
        {/* Court outline */}
        <rect x="5" y="5" width="210" height="120" fill="none" stroke="white" strokeWidth="1.5" />
        {/* Center line */}
        <line x1="5" y1="65" x2="215" y2="65" stroke="white" strokeWidth="1.5" />
        {/* Center circle */}
        <circle cx="110" cy="65" r="18" fill="none" stroke="white" strokeWidth="1.5" />
        {/* Home key (left) */}
        <rect x="5" y="37" width="48" height="56" fill="none" stroke="white" strokeWidth="1" />
        <ellipse cx="53" cy="65" rx="18" ry="18" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 2" />
        <circle cx="20" cy="65" r="4" fill="none" stroke="white" strokeWidth="1" />
        {/* Away key (right) */}
        <rect x="167" y="37" width="48" height="56" fill="none" stroke="white" strokeWidth="1" />
        <ellipse cx="167" cy="65" rx="18" ry="18" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 2" />
        <circle cx="200" cy="65" r="4" fill="none" stroke="white" strokeWidth="1" />
        {/* Labels */}
        <text x="32" y="12" fontSize="7" fill="white" opacity="0.7" textAnchor="middle">{homeName.split(' ')[0]}</text>
        <text x="190" y="12" fontSize="7" fill="white" opacity="0.7" textAnchor="middle">{awayName.split(' ')[0]}</text>
      </svg>
    </div>
  )
}

// ── Hockey rink SVG for sidebar ──
function HockeyRinkSVG({ homeName, awayName }: { homeName: string; awayName: string }) {
  return (
    <div className="relative">
      <svg viewBox="0 0 220 130" className="w-full" style={{ display: 'block' }}>
        {/* Rink surface */}
        <rect width="220" height="130" rx="20" fill="#c8e8f5" />
        {/* Rink outline */}
        <rect x="4" y="4" width="212" height="122" rx="18" fill="none" stroke="#1a6e9e" strokeWidth="2" />
        {/* Center red line */}
        <line x1="110" y1="4" x2="110" y2="126" stroke="#d42020" strokeWidth="2" />
        {/* Center circle */}
        <circle cx="110" cy="65" r="20" fill="none" stroke="#1a6e9e" strokeWidth="1.5" />
        <circle cx="110" cy="65" r="3" fill="#d42020" />
        {/* Home blue line (left) */}
        <line x1="73" y1="4" x2="73" y2="126" stroke="#1a6e9e" strokeWidth="1.5" />
        {/* Away blue line (right) */}
        <line x1="147" y1="4" x2="147" y2="126" stroke="#1a6e9e" strokeWidth="1.5" />
        {/* Home goal crease */}
        <rect x="4" y="48" width="22" height="34" fill="none" stroke="#1a6e9e" strokeWidth="1" />
        <ellipse cx="26" cy="65" rx="12" ry="14" fill="rgba(100,160,220,0.25)" stroke="#1a6e9e" strokeWidth="1" />
        {/* Away goal crease */}
        <rect x="194" y="48" width="22" height="34" fill="none" stroke="#1a6e9e" strokeWidth="1" />
        <ellipse cx="194" cy="65" rx="12" ry="14" fill="rgba(100,160,220,0.25)" stroke="#1a6e9e" strokeWidth="1" />
        {/* Labels */}
        <text x="37" y="12" fontSize="7" fill="#1a6e9e" opacity="0.8" textAnchor="middle">{homeName.split(' ')[0]}</text>
        <text x="183" y="12" fontSize="7" fill="#1a6e9e" opacity="0.8" textAnchor="middle">{awayName.split(' ')[0]}</text>
      </svg>
    </div>
  )
}

function SidebarLineupsPanel({
  lineups,
  match,
  sport,
  hasLineups,
}: {
  lineups: Lineups | null
  match: MatchDetails['match']
  sport: string
  hasLineups: boolean
}) {
  const hasData = lineups && (lineups.home || lineups.away)
  const [showBenchHome, setShowBenchHome] = useState(false)
  const [showBenchAway, setShowBenchAway] = useState(false)
  const isSoccer = sport === 'soccer' || sport === 'football' || sport === 'rugby'
  const isBasketball = sport === 'basketball'
  const isHockey = sport === 'ice-hockey' || sport === 'hockey' || sport === 'ice_hockey'

  const headerBadge = hasData && (
    <span className={cn(
      "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full",
      hasLineups ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
    )}>
      {hasLineups ? "Confirmed" : "Predicted"}
    </span>
  )

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Shirt className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-bold text-foreground">
          {isSoccer ? 'Formation' : isBasketball ? 'Rosters' : isHockey ? 'Rosters' : 'Lineups'}
        </h2>
        {headerBadge}
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-border bg-card px-3 py-8 text-center">
          {isSoccer ? (
            <>
              {/* Mini empty pitch placeholder */}
              <div className="mx-auto mb-3 rounded-lg overflow-hidden" style={{ width: 80, height: 110, background: 'linear-gradient(180deg,#1a5c2a,#1e7a35)' }}>
                <svg viewBox="0 0 80 110" className="w-full h-full opacity-20">
                  <rect x="4" y="4" width="72" height="102" fill="none" stroke="white" strokeWidth="1.5" />
                  <line x1="4" y1="55" x2="76" y2="55" stroke="white" strokeWidth="1.5" />
                  <circle cx="40" cy="55" r="14" fill="none" stroke="white" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Formation not announced</p>
            </>
          ) : isBasketball ? (
            <>
              <div className="mx-auto mb-3 rounded-lg overflow-hidden" style={{ width: 80, height: 110, background: '#c8802a' }}>
                <svg viewBox="0 0 80 110" className="w-full h-full opacity-20">
                  <rect x="4" y="4" width="72" height="102" fill="none" stroke="white" strokeWidth="1.5" />
                  <line x1="4" y1="55" x2="76" y2="55" stroke="white" strokeWidth="1.5" />
                  <circle cx="40" cy="55" r="14" fill="none" stroke="white" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Rosters not available</p>
            </>
          ) : (
            <>
              <Shirt className="h-8 w-8 mx-auto mb-2 opacity-25" />
              <p className="text-xs font-medium text-muted-foreground">Not announced yet</p>
            </>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">Usually 1h before kickoff</p>
        </div>
      ) : isSoccer ? (
        /* ── SOCCER / RUGBY: real formation pitch ── */
        <div className="space-y-2">
          {/* Vertical pitch — always shown in sidebar regardless of breakpoint */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a5c2a 0%, #1e7a35 50%, #1a5c2a 100%)' }}>
            <svg className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" style={{ display: 'none' }} />
            {/* We render a compact VerticalPitch inline here to bypass md: breakpoints */}
            <SidebarPitch home={buildPitchData(lineups.home)} away={buildPitchData(lineups.away)} />
          </div>
          {/* Bench toggles */}
          {lineups.home && lineups.home.bench.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-2.5 py-2 text-[11px] font-semibold hover:bg-muted/40 transition-colors"
                onClick={() => setShowBenchHome(v => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <TeamLogo teamName={match.homeTeam.name} logoUrl={match.homeTeam.logo} size="xs" />
                  {match.homeTeam.name} bench
                </span>
                {showBenchHome ? <ChevronUp className="h-3 w-3 opacity-60" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
              </button>
              {showBenchHome && (
                <div className="border-t border-border/40 p-2 space-y-0.5">
                  {lineups.home.bench.slice(0, 9).map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 py-0.5">
                      <span className="w-4 text-[10px] font-mono text-muted-foreground">{p.jersey || '—'}</span>
                      <span className="text-[10px] truncate flex-1">{p.name}</span>
                      {p.position && <span className="text-[9px] text-muted-foreground uppercase">{p.position.slice(0, 3)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {lineups.away && lineups.away.bench.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-2.5 py-2 text-[11px] font-semibold hover:bg-muted/40 transition-colors"
                onClick={() => setShowBenchAway(v => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <TeamLogo teamName={match.awayTeam.name} logoUrl={match.awayTeam.logo} size="xs" />
                  {match.awayTeam.name} bench
                </span>
                {showBenchAway ? <ChevronUp className="h-3 w-3 opacity-60" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
              </button>
              {showBenchAway && (
                <div className="border-t border-border/40 p-2 space-y-0.5">
                  {lineups.away.bench.slice(0, 9).map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 py-0.5">
                      <span className="w-4 text-[10px] font-mono text-muted-foreground">{p.jersey || '—'}</span>
                      <span className="text-[10px] truncate flex-1">{p.name}</span>
                      {p.position && <span className="text-[9px] text-muted-foreground uppercase">{p.position.slice(0, 3)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : isBasketball ? (
        /* ── BASKETBALL: court with team info ── */
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden" style={{ background: '#7c4a1a' }}>
            <BasketballCourtSVG homeName={match.homeTeam.name} awayName={match.awayTeam.name} />
          </div>
          {[
            { roster: lineups.home, team: match.homeTeam, color: 'bg-rose-500' },
            { roster: lineups.away, team: match.awayTeam, color: 'bg-sky-500' },
          ].map(({ roster, team, color }) => roster ? (
            <div key={team.name} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/40">
                <div className={cn("h-2 w-2 rounded-full shrink-0", color)} />
                <TeamLogo teamName={team.name} logoUrl={team.logo} size="xs" />
                <span className="text-[11px] font-bold truncate">{team.name}</span>
              </div>
              <div className="p-2 space-y-0.5">
                {roster.starting.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 py-0.5">
                    <span className="w-4 text-[10px] font-mono text-muted-foreground">{p.jersey || (i + 1)}</span>
                    <span className="text-[10px] truncate flex-1">{p.name}</span>
                    {p.position && <span className="text-[9px] text-muted-foreground uppercase">{p.position.slice(0, 2)}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null)}
        </div>
      ) : isHockey ? (
        /* ── HOCKEY: ice rink ── */
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden">
            <HockeyRinkSVG homeName={match.homeTeam.name} awayName={match.awayTeam.name} />
          </div>
          {[
            { roster: lineups.home, team: match.homeTeam },
            { roster: lineups.away, team: match.awayTeam },
          ].map(({ roster, team }) => roster ? (
            <div key={team.name} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/40">
                <TeamLogo teamName={team.name} logoUrl={team.logo} size="xs" />
                <span className="text-[11px] font-bold truncate">{team.name}</span>
              </div>
              <div className="p-2 space-y-0.5">
                {roster.starting.slice(0, 6).map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 py-0.5">
                    <span className="w-4 text-[10px] font-mono text-muted-foreground">{p.jersey || (i + 1)}</span>
                    <span className="text-[10px] truncate flex-1">{p.name}</span>
                    {p.position && <span className="text-[9px] text-muted-foreground uppercase">{p.position.slice(0, 2)}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null)}
        </div>
      ) : (
        /* ── DEFAULT: plain compact list ── */
        <div className="space-y-3">
          {[
            { roster: lineups.home, team: match.homeTeam, side: "Home" },
            { roster: lineups.away, team: match.awayTeam, side: "Away" },
          ].map(({ roster, team, side }) =>
            roster ? (
              <div key={side} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/50 px-2.5 py-2">
                  <TeamLogo teamName={team.name} logoUrl={team.logo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-foreground truncate">{team.name}</p>
                    {roster.formation && <p className="text-[10px] text-muted-foreground">{roster.formation}</p>}
                  </div>
                </div>
                <div className="p-2 space-y-0.5">
                  {roster.starting.slice(0, 11).map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 py-0.5">
                      <span className="w-4 text-center text-[10px] font-mono text-muted-foreground shrink-0">{p.jersey || (i + 1)}</span>
                      <span className="text-[11px] text-foreground truncate flex-1">{p.name}</span>
                      {p.position && <span className="text-[9px] text-muted-foreground uppercase font-medium shrink-0">{p.position.slice(0, 3)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </section>
  )
}

function RosterCard({ side, roster, isConfirmed }: { side: string; roster: TeamRoster; isConfirmed?: boolean }) {
  const [showBench, setShowBench] = useState(false)
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TeamLogo teamName={roster.teamName || ''} logoUrl={roster.teamLogo} size="sm" />
            <div>
              <p className="text-sm font-bold">{roster.teamName}</p>
              <p className="text-xs text-muted-foreground">
                {side}{roster.formation ? ` • ${roster.formation}` : ''}
              </p>
            </div>
          </div>
          <Badge className={cn(
            "text-[9px] px-2 py-0.5",
            isConfirmed
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              : "bg-amber-500/15 text-amber-600 border-amber-500/30"
          )}>
            {isConfirmed ? 'Confirmed' : 'Predicted'}
          </Badge>
        </div>
        {roster.coach && (
          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />Coach: <span className="font-medium text-foreground">{roster.coach}</span>
          </p>
        )}
      </div>
      <CardContent className="p-3">
        {roster.starting.length > 0 && (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Starting XI</p>
            <div className="mb-3 space-y-0.5">
              {roster.starting.map((p, i) => <PlayerRow key={i} player={p} />)}
            </div>
          </>
        )}
        {roster.bench.length > 0 && (
          <>
            <button
              className="flex w-full items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
              onClick={() => setShowBench(!showBench)}
            >
              {showBench ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Bench ({roster.bench.length})
            </button>
            {showBench && (
              <div className="space-y-0.5">
                {roster.bench.slice(0, 12).map((p, i) => <PlayerRow key={i} player={p} bench />)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PlayerRow({ player, bench }: { player: Player; bench?: boolean }) {
  const Wrapper: React.ElementType = player.id ? Link : 'div'
  const wrapperProps = player.id
    ? { href: playerHref(player.fullName || player.name, player.id) }
    : {}
  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
        player.id ? "hover:bg-primary/10 cursor-pointer" : "hover:bg-muted/50",
        bench && "opacity-70",
      )}
    >
      <span className="w-6 text-center font-mono text-xs text-muted-foreground shrink-0">{player.jersey || '-'}</span>
      <PlayerAvatar
        id={player.id}
        name={player.fullName || player.name}
        headshot={player.headshot}
        size="sm"
        ring="border"
        noLink
      />
      <span className={cn(
        "flex-1 truncate font-medium",
        player.id && "group-hover:text-primary group-hover:underline underline-offset-2",
      )}>{player.fullName || player.name}</span>
      {player.position && (
        <Badge variant="outline" className="text-[9px] py-0 px-1.5 shrink-0">{player.position}</Badge>
      )}
    </Wrapper>
  )
}

function NewsRow({ item }: { item: NewsItem }) {
  const inner = (
    <div className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-muted/50">
      {item.image && (
        <Image src={item.image} alt="" width={80} height={60} className="h-16 w-20 shrink-0 rounded-lg object-cover" unoptimized />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.headline}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
        {item.published && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/60">
            {new Date(item.published).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
  // Open the article on our own news reader page instead of jumping to ESPN.
  // We pass the article metadata as URL params so the reader can render it
  // inline without an additional roundtrip.
  if (!item.headline) return inner
  const params = new URLSearchParams()
  params.set('headline', item.headline)
  if (item.description) params.set('description', item.description)
  if (item.image) params.set('image', item.image)
  if (item.published) params.set('published', item.published)
  if (item.link) params.set('source_url', item.link)
  if (item.source) params.set('source', item.source)
  return (
    <Link href={`/news/article?${params.toString()}`}>
      {inner}
    </Link>
  )
}

// ===== TipCard Component =====
// ─── Team Stats tab (live + finished) ───────────────────────────────────────
function TeamStatsTab({
  teamStats, homeName, awayName, homeLogo, awayLogo, homeTeamId, awayTeamId, isLive, isFinished,
}: {
  teamStats: TeamStatsBlock | null
  homeName: string
  awayName: string
  homeLogo?: string
  awayLogo?: string
  homeTeamId?: string
  awayTeamId?: string
  isLive: boolean
  isFinished: boolean
}) {
  if (!teamStats || (teamStats.home.stats.length === 0 && teamStats.away.stats.length === 0)) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">
            {isLive || isFinished ? 'No statistics yet' : 'Stats appear once the match starts'}
          </p>
          <p className="text-sm mt-1">
            {isLive || isFinished
              ? 'The data feed has not published team stats for this fixture.'
              : 'Live possession, shots and more will show here once the whistle blows.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Pair up stats by name, preferring labels from the home side.
  const map = new Map<string, { label: string; home: string; away: string }>()
  for (const s of teamStats.home.stats) {
    map.set(s.name, { label: s.label, home: s.displayValue, away: '' })
  }
  for (const s of teamStats.away.stats) {
    const existing = map.get(s.name)
    if (existing) existing.away = s.displayValue
    else map.set(s.name, { label: s.label, home: '', away: s.displayValue })
  }
  const rows = Array.from(map.values()).filter(r => r.home || r.away)

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Team Stats</h3>
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-500">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-4 grid grid-cols-3 items-center gap-2 text-xs font-semibold">
          {homeTeamId ? (
            <Link
              href={teamHref(homeName, homeTeamId)}
              className="group flex items-center gap-2 justify-end text-right hover:text-primary"
            >
              <span className="truncate group-hover:underline">{homeName}</span>
              <TeamLogo teamName={homeName} logoUrl={homeLogo} size="xs" />
            </Link>
          ) : (
            <div className="flex items-center gap-2 justify-end text-right">
              <span className="truncate">{homeName}</span>
              <TeamLogo teamName={homeName} logoUrl={homeLogo} size="xs" />
            </div>
          )}
          <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">vs</div>
          {awayTeamId ? (
            <Link
              href={teamHref(awayName, awayTeamId)}
              className="group flex items-center gap-2 hover:text-primary"
            >
              <TeamLogo teamName={awayName} logoUrl={awayLogo} size="xs" />
              <span className="truncate group-hover:underline">{awayName}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <TeamLogo teamName={awayName} logoUrl={awayLogo} size="xs" />
              <span className="truncate">{awayName}</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => <StatComparisonRow key={i} {...row} />)}
        </div>
      </CardContent>
    </Card>
  )
}

function StatComparisonRow({ label, home, away }: { label: string; home: string; away: string }) {
  // Try to derive bar widths from numeric values when possible.
  const hNum = parseFloat((home || '').replace(/[^\d.\-]/g, ''))
  const aNum = parseFloat((away || '').replace(/[^\d.\-]/g, ''))
  const hasNums = Number.isFinite(hNum) && Number.isFinite(aNum) && (hNum + aNum) > 0
  const total = hasNums ? hNum + aNum : 1
  const hPct = hasNums ? Math.max(2, Math.round((hNum / total) * 100)) : 50
  const aPct = hasNums ? 100 - hPct : 50
  const hLeads = hasNums && hNum > aNum
  const aLeads = hasNums && aNum > hNum

  return (
    <div>
      <div className="mb-1 grid grid-cols-3 items-center gap-2 text-xs">
        <span className={cn("text-right font-mono font-bold", hLeads && "text-primary")}>{home || '—'}</span>
        <span className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("font-mono font-bold", aLeads && "text-primary")}>{away || '—'}</span>
      </div>
      <div className="flex items-center gap-1 h-1.5">
        <div className="flex-1 bg-muted rounded-l-full overflow-hidden flex justify-end">
          <div
            className={cn("h-full transition-all", hLeads ? "bg-primary" : "bg-muted-foreground/40")}
            style={{ width: `${hPct}%` }}
          />
        </div>
        <div className="flex-1 bg-muted rounded-r-full overflow-hidden">
          <div
            className={cn("h-full transition-all", aLeads ? "bg-primary" : "bg-muted-foreground/40")}
            style={{ width: `${aPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function TipCard({ tip }: { tip: MatchTip }) {
  const { isAuthenticated } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [likes, setLikes] = useState<number>(tip.likes)
  const [liked, setLiked] = useState<boolean>(!!tip.liked)
  const [commentCount, setCommentCount] = useState<number>(tip.comments)
  const [showComments, setShowComments] = useState<boolean>(false)
  const [comments, setComments] = useState<TipCommentDto[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState<boolean>(false)
  const [draft, setDraft] = useState<string>('')
  const [posting, setPosting] = useState<boolean>(false)

  const tipsterUrl = tipsterHref(
    tip.tipster.username || tip.tipster.displayName,
    tip.tipster.username || tip.tipster.id,
  )

  const handleLike = async () => {
    if (!isAuthenticated) { openAuthModal('login'); return }
    const prevLiked = liked, prevLikes = likes
    setLiked(!prevLiked)
    setLikes(l => l + (prevLiked ? -1 : 1))
    try {
      const res = await fetch(`/api/tips/${tip.id}/like`, { method: prevLiked ? 'DELETE' : 'POST' })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setLikes(data.count)
      setLiked(data.liked)
    } catch {
      setLiked(prevLiked); setLikes(prevLikes)
    }
  }

  const loadComments = async () => {
    setShowComments(s => !s)
    if (commentsLoaded) return
    try {
      const r = await fetch(`/api/tips/${tip.id}/comments`)
      if (r.ok) {
        const j = await r.json()
        setComments(j.comments || [])
      }
    } finally { setCommentsLoaded(true) }
  }

  const submitComment = async () => {
    const text = draft.trim()
    if (!text) return
    if (!isAuthenticated) { openAuthModal('login'); return }
    setPosting(true)
    try {
      const r = await fetch(`/api/tips/${tip.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (r.ok) {
        const j = await r.json()
        setComments(c => [...c, j.comment])
        setCommentCount(c => c + 1)
        setDraft('')
      }
    } finally { setPosting(false) }
  }

  const confidenceColor =
    tip.confidence >= 80 ? 'text-emerald-500' :
    tip.confidence >= 65 ? 'text-amber-500' :
    'text-muted-foreground'

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-sm",
      tip.tipster.isPremium && tip.isPremium && "border-amber-500/20"
    )}>
      {/* Compact single-row header */}
      <div className={cn(
        "flex items-center justify-between gap-2 px-3 py-2",
        tip.tipster.isPremium && tip.isPremium && "bg-gradient-to-r from-amber-500/5 to-transparent"
      )}>
        <Link href={tipsterUrl} className="flex items-center gap-2 hover:opacity-80 min-w-0 flex-1">
          <Avatar className="h-7 w-7 shrink-0 border border-primary/20">
            {tip.tipster.avatar && <AvatarImage src={tip.tipster.avatar} alt={tip.tipster.displayName} />}
            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
              {tip.tipster.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-xs truncate">{tip.tipster.displayName}</span>
              {tip.tipster.isPremium && (
                <Badge className="h-3.5 shrink-0 gap-0.5 bg-amber-500/15 text-amber-600 border-amber-500/30 text-[8px] px-1">
                  <Star className="h-2 w-2 fill-current" />PRO
                </Badge>
              )}
              {tip.tipster.verified && (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="text-emerald-500 font-semibold">{tip.tipster.winRate}%</span>
              <span className={cn(tip.tipster.roi > 0 ? "text-emerald-500" : "text-rose-500", "font-semibold")}>
                {tip.tipster.roi > 0 ? '+' : ''}{tip.tipster.roi}% ROI
              </span>
              <span>·</span>
              <span>{tip.tipster.followers.toLocaleString()} followers</span>
            </div>
          </div>
        </Link>
        {/* Compact stake dots inline */}
        <div className="flex items-center gap-0.5 shrink-0" title={`Stake ${tip.stake}/5`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("h-1.5 w-1.5 rounded-sm", i < tip.stake ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {/* Pick row: market + pick + odds + conf in one strip */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">{tip.market}</div>
            <div className="text-sm font-bold text-primary leading-tight truncate">{tip.prediction}</div>
          </div>
          <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-2 py-1.5 text-center min-w-[52px]">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Odds</div>
            <div className="text-sm font-bold text-emerald-500">{tip.odds.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center min-w-[46px]">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Conf.</div>
            <div className={cn("text-sm font-bold", confidenceColor)}>{tip.confidence}%</div>
          </div>
        </div>

        {/* Analysis (compact) */}
        {tip.isPremium && tip.tipster.isPremium ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-amber-600 text-xs">
              <Lock className="h-3 w-3 shrink-0" />
              <span>Premium analysis — Subscribe to unlock</span>
            </div>
            <Button size="sm" variant="outline" className="h-6 shrink-0 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 text-[10px] px-2">
              Unlock
            </Button>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground leading-snug line-clamp-2">{tip.analysis}</p>
        )}
      </div>

      {/* Footer with real likes + comments toggle */}
      <div className="flex items-center justify-between gap-2 border-t border-border/40 px-2 py-1">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="sm"
            className={cn("h-6 gap-1 px-1.5 text-[11px]", liked && "text-emerald-500")}
            onClick={handleLike}
          >
            <ThumbsUp className={cn("h-3 w-3", liked && "fill-current")} />{likes}
          </Button>
          <Button
            variant="ghost" size="sm"
            className={cn("h-6 gap-1 px-1.5 text-[11px]", showComments && "text-primary")}
            onClick={loadComments}
          >
            <MessageCircle className="h-3 w-3" />{commentCount}
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          {tip.status === 'won' && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600 border border-emerald-500/20">
              <CheckCircle2 className="h-2.5 w-2.5" />WON
            </span>
          )}
          {tip.status === 'lost' && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-500 border border-rose-500/20">
              ✕ LOST
            </span>
          )}
          {tip.status === 'void' && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground border border-border">
              VOID
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(tip.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Comment thread */}
      {showComments && (
        <div className="border-t border-border/40 px-3 py-2 space-y-2 bg-muted/20">
          {comments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-1">No comments yet — be the first.</p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-auto">
              {comments.map(c => (
                <li key={c.id} className="text-xs">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-foreground">{c.authorName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-snug">{c.content}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              placeholder={isAuthenticated ? 'Add a comment...' : 'Sign in to comment'}
              disabled={!isAuthenticated || posting}
              rows={1}
              className="flex-1 resize-none rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" className="h-7 px-2 text-[11px]" onClick={submitComment} disabled={!draft.trim() || posting}>
              Post
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
