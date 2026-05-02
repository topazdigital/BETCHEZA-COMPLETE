"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { FlagIcon } from "@/components/ui/flag-icon"

interface TeamLogoProps {
  teamName: string
  teamId?: number
  leagueId?: number
  /** Real logo URL (e.g. from ESPN). Takes precedence over the static map. */
  logoUrl?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  showFallback?: boolean
  /**
   * Visual treatment.
   *  - 'team' (default): rounded crest, object-contain (preserves logo whitespace)
   *  - 'athlete': rounded portrait, object-cover (fills frame for individual sports
   *    like tennis, MMA, boxing, golf, racing).
   */
  variant?: 'team' | 'athlete'
  /** Sport slug — when provided, automatically picks athlete variant for individual sports. */
  sportSlug?: string
  /**
   * ISO country code (e.g. 'GB-ENG', 'KE', 'BR'). When the logo can't be
   * found, we render a small country-flag chip on top of the initials so
   * users still get visual context — particularly valuable for small leagues
   * where ESPN doesn't supply a crest.
   */
  countryCode?: string
}

// Sports where each "team" is actually an individual competitor (use portrait avatars).
const INDIVIDUAL_SPORTS = new Set([
  'tennis', 'mma', 'boxing', 'golf', 'racing', 'motorsport', 'formula1', 'f1', 'darts', 'snooker', 'cycling',
])

export function isIndividualSport(slug?: string): boolean {
  return !!slug && INDIVIDUAL_SPORTS.has(slug.toLowerCase())
}

// Team to logo URL mappings (using public APIs and Wikimedia)
const TEAM_LOGOS: Record<string, string> = {
  // Premier League
  'Arsenal': 'https://media.api-sports.io/football/teams/42.png',
  'Manchester City': 'https://media.api-sports.io/football/teams/50.png',
  'Liverpool': 'https://media.api-sports.io/football/teams/40.png',
  'Manchester United': 'https://media.api-sports.io/football/teams/33.png',
  'Chelsea': 'https://media.api-sports.io/football/teams/49.png',
  'Tottenham Hotspur': 'https://media.api-sports.io/football/teams/47.png',
  'Tottenham': 'https://media.api-sports.io/football/teams/47.png',
  'Newcastle United': 'https://media.api-sports.io/football/teams/34.png',
  'Newcastle': 'https://media.api-sports.io/football/teams/34.png',
  'Brighton': 'https://media.api-sports.io/football/teams/51.png',
  'Brighton & Hove Albion': 'https://media.api-sports.io/football/teams/51.png',
  'Aston Villa': 'https://media.api-sports.io/football/teams/66.png',
  'West Ham': 'https://media.api-sports.io/football/teams/48.png',
  'West Ham United': 'https://media.api-sports.io/football/teams/48.png',
  'Crystal Palace': 'https://media.api-sports.io/football/teams/52.png',
  'Fulham': 'https://media.api-sports.io/football/teams/36.png',
  'Everton': 'https://media.api-sports.io/football/teams/45.png',
  'Brentford': 'https://media.api-sports.io/football/teams/55.png',
  'Nottingham Forest': 'https://media.api-sports.io/football/teams/65.png',
  'Wolves': 'https://media.api-sports.io/football/teams/39.png',
  'Wolverhampton Wanderers': 'https://media.api-sports.io/football/teams/39.png',
  'Bournemouth': 'https://media.api-sports.io/football/teams/35.png',
  'AFC Bournemouth': 'https://media.api-sports.io/football/teams/35.png',
  'Leicester City': 'https://media.api-sports.io/football/teams/46.png',
  'Leicester': 'https://media.api-sports.io/football/teams/46.png',
  'Southampton': 'https://media.api-sports.io/football/teams/41.png',
  'Ipswich Town': 'https://media.api-sports.io/football/teams/57.png',
  'Ipswich': 'https://media.api-sports.io/football/teams/57.png',

  // La Liga
  'Real Madrid': 'https://media.api-sports.io/football/teams/541.png',
  'Barcelona': 'https://media.api-sports.io/football/teams/529.png',
  'FC Barcelona': 'https://media.api-sports.io/football/teams/529.png',
  'Atletico Madrid': 'https://media.api-sports.io/football/teams/530.png',
  'Atlético Madrid': 'https://media.api-sports.io/football/teams/530.png',
  'Sevilla': 'https://media.api-sports.io/football/teams/536.png',
  'Sevilla FC': 'https://media.api-sports.io/football/teams/536.png',
  'Real Sociedad': 'https://media.api-sports.io/football/teams/548.png',
  'Real Betis': 'https://media.api-sports.io/football/teams/543.png',
  'Villarreal': 'https://media.api-sports.io/football/teams/533.png',
  'Villarreal CF': 'https://media.api-sports.io/football/teams/533.png',
  'Athletic Bilbao': 'https://media.api-sports.io/football/teams/531.png',
  'Athletic Club': 'https://media.api-sports.io/football/teams/531.png',
  'Valencia': 'https://media.api-sports.io/football/teams/532.png',
  'Valencia CF': 'https://media.api-sports.io/football/teams/532.png',
  'Girona': 'https://media.api-sports.io/football/teams/547.png',
  'Girona FC': 'https://media.api-sports.io/football/teams/547.png',

  // Bundesliga
  'Bayern Munich': 'https://media.api-sports.io/football/teams/157.png',
  'Bayern München': 'https://media.api-sports.io/football/teams/157.png',
  'FC Bayern Munich': 'https://media.api-sports.io/football/teams/157.png',
  'Borussia Dortmund': 'https://media.api-sports.io/football/teams/165.png',
  'Dortmund': 'https://media.api-sports.io/football/teams/165.png',
  'RB Leipzig': 'https://media.api-sports.io/football/teams/173.png',
  'Leipzig': 'https://media.api-sports.io/football/teams/173.png',
  'Bayer Leverkusen': 'https://media.api-sports.io/football/teams/168.png',
  'Leverkusen': 'https://media.api-sports.io/football/teams/168.png',
  'Eintracht Frankfurt': 'https://media.api-sports.io/football/teams/169.png',
  'Frankfurt': 'https://media.api-sports.io/football/teams/169.png',
  'Union Berlin': 'https://media.api-sports.io/football/teams/182.png',
  'SC Freiburg': 'https://media.api-sports.io/football/teams/160.png',
  'Freiburg': 'https://media.api-sports.io/football/teams/160.png',
  'VfB Stuttgart': 'https://media.api-sports.io/football/teams/172.png',
  'Stuttgart': 'https://media.api-sports.io/football/teams/172.png',
  'Borussia Monchengladbach': 'https://media.api-sports.io/football/teams/163.png',
  'Werder Bremen': 'https://media.api-sports.io/football/teams/162.png',
  'Wolfsburg': 'https://media.api-sports.io/football/teams/161.png',

  // Serie A
  'Inter Milan': 'https://media.api-sports.io/football/teams/505.png',
  'Inter': 'https://media.api-sports.io/football/teams/505.png',
  'Internazionale': 'https://media.api-sports.io/football/teams/505.png',
  'AC Milan': 'https://media.api-sports.io/football/teams/489.png',
  'Milan': 'https://media.api-sports.io/football/teams/489.png',
  'Juventus': 'https://media.api-sports.io/football/teams/496.png',
  'Napoli': 'https://media.api-sports.io/football/teams/492.png',
  'SSC Napoli': 'https://media.api-sports.io/football/teams/492.png',
  'AS Roma': 'https://media.api-sports.io/football/teams/497.png',
  'Roma': 'https://media.api-sports.io/football/teams/497.png',
  'Lazio': 'https://media.api-sports.io/football/teams/487.png',
  'SS Lazio': 'https://media.api-sports.io/football/teams/487.png',
  'Atalanta': 'https://media.api-sports.io/football/teams/499.png',
  'Fiorentina': 'https://media.api-sports.io/football/teams/502.png',
  'ACF Fiorentina': 'https://media.api-sports.io/football/teams/502.png',
  'Bologna': 'https://media.api-sports.io/football/teams/500.png',
  'Torino': 'https://media.api-sports.io/football/teams/503.png',

  // Ligue 1
  'Paris Saint-Germain': 'https://media.api-sports.io/football/teams/85.png',
  'PSG': 'https://media.api-sports.io/football/teams/85.png',
  'Monaco': 'https://media.api-sports.io/football/teams/91.png',
  'AS Monaco': 'https://media.api-sports.io/football/teams/91.png',
  'Marseille': 'https://media.api-sports.io/football/teams/81.png',
  'Olympique Marseille': 'https://media.api-sports.io/football/teams/81.png',
  'Lyon': 'https://media.api-sports.io/football/teams/80.png',
  'Olympique Lyon': 'https://media.api-sports.io/football/teams/80.png',
  'Lille': 'https://media.api-sports.io/football/teams/79.png',
  'LOSC Lille': 'https://media.api-sports.io/football/teams/79.png',
  'Nice': 'https://media.api-sports.io/football/teams/84.png',
  'Lens': 'https://media.api-sports.io/football/teams/116.png',

  // NBA
  'Los Angeles Lakers': 'https://media.api-sports.io/basketball/teams/145.png',
  'Lakers': 'https://media.api-sports.io/basketball/teams/145.png',
  'LAL': 'https://media.api-sports.io/basketball/teams/145.png',
  'Golden State Warriors': 'https://media.api-sports.io/basketball/teams/140.png',
  'Warriors': 'https://media.api-sports.io/basketball/teams/140.png',
  'GSW': 'https://media.api-sports.io/basketball/teams/140.png',
  'Boston Celtics': 'https://media.api-sports.io/basketball/teams/133.png',
  'Celtics': 'https://media.api-sports.io/basketball/teams/133.png',
  'BOS': 'https://media.api-sports.io/basketball/teams/133.png',
  'Miami Heat': 'https://media.api-sports.io/basketball/teams/146.png',
  'Heat': 'https://media.api-sports.io/basketball/teams/146.png',
  'MIA': 'https://media.api-sports.io/basketball/teams/146.png',
  'Denver Nuggets': 'https://media.api-sports.io/basketball/teams/138.png',
  'Nuggets': 'https://media.api-sports.io/basketball/teams/138.png',
  'DEN': 'https://media.api-sports.io/basketball/teams/138.png',
  'Milwaukee Bucks': 'https://media.api-sports.io/basketball/teams/147.png',
  'Bucks': 'https://media.api-sports.io/basketball/teams/147.png',
  'MIL': 'https://media.api-sports.io/basketball/teams/147.png',
  'Phoenix Suns': 'https://media.api-sports.io/basketball/teams/151.png',
  'Suns': 'https://media.api-sports.io/basketball/teams/151.png',
  'PHX': 'https://media.api-sports.io/basketball/teams/151.png',
  'Dallas Mavericks': 'https://media.api-sports.io/basketball/teams/137.png',
  'Mavericks': 'https://media.api-sports.io/basketball/teams/137.png',
  'DAL': 'https://media.api-sports.io/basketball/teams/137.png',
  'Cleveland Cavaliers': 'https://media.api-sports.io/basketball/teams/135.png',
  'Cavaliers': 'https://media.api-sports.io/basketball/teams/135.png',
  'CLE': 'https://media.api-sports.io/basketball/teams/135.png',
  'Oklahoma City Thunder': 'https://media.api-sports.io/basketball/teams/149.png',
  'Thunder': 'https://media.api-sports.io/basketball/teams/149.png',
  'OKC': 'https://media.api-sports.io/basketball/teams/149.png',
  'New York Knicks': 'https://media.api-sports.io/basketball/teams/148.png',
  'Knicks': 'https://media.api-sports.io/basketball/teams/148.png',
  'NYK': 'https://media.api-sports.io/basketball/teams/148.png',
  'Philadelphia 76ers': 'https://media.api-sports.io/basketball/teams/150.png',
  '76ers': 'https://media.api-sports.io/basketball/teams/150.png',
  'PHI': 'https://media.api-sports.io/basketball/teams/150.png',

  // NFL
  'Kansas City Chiefs': 'https://media.api-sports.io/american-football/teams/12.png',
  'Chiefs': 'https://media.api-sports.io/american-football/teams/12.png',
  'KC': 'https://media.api-sports.io/american-football/teams/12.png',
  'Philadelphia Eagles': 'https://media.api-sports.io/american-football/teams/20.png',
  'Eagles': 'https://media.api-sports.io/american-football/teams/20.png',
  'PHI': 'https://media.api-sports.io/american-football/teams/20.png',
  'San Francisco 49ers': 'https://media.api-sports.io/american-football/teams/25.png',
  '49ers': 'https://media.api-sports.io/american-football/teams/25.png',
  'SF': 'https://media.api-sports.io/american-football/teams/25.png',
  'Dallas Cowboys': 'https://media.api-sports.io/american-football/teams/8.png',
  'Cowboys': 'https://media.api-sports.io/american-football/teams/8.png',
  'Buffalo Bills': 'https://media.api-sports.io/american-football/teams/4.png',
  'Bills': 'https://media.api-sports.io/american-football/teams/4.png',
  'BUF': 'https://media.api-sports.io/american-football/teams/4.png',
  'Miami Dolphins': 'https://media.api-sports.io/american-football/teams/18.png',
  'Dolphins': 'https://media.api-sports.io/american-football/teams/18.png',
  'Detroit Lions': 'https://media.api-sports.io/american-football/teams/10.png',
  'Lions': 'https://media.api-sports.io/american-football/teams/10.png',
  'DET': 'https://media.api-sports.io/american-football/teams/10.png',
  'Baltimore Ravens': 'https://media.api-sports.io/american-football/teams/3.png',
  'Ravens': 'https://media.api-sports.io/american-football/teams/3.png',
  'BAL': 'https://media.api-sports.io/american-football/teams/3.png',
  'Green Bay Packers': 'https://media.api-sports.io/american-football/teams/11.png',
  'Packers': 'https://media.api-sports.io/american-football/teams/11.png',
  'GB': 'https://media.api-sports.io/american-football/teams/11.png',
  'New England Patriots': 'https://media.api-sports.io/american-football/teams/19.png',
  'Patriots': 'https://media.api-sports.io/american-football/teams/19.png',
  'NE': 'https://media.api-sports.io/american-football/teams/19.png',

  // NHL
  'Tampa Bay Lightning': 'https://media.api-sports.io/hockey/teams/7.png',
  'Lightning': 'https://media.api-sports.io/hockey/teams/7.png',
  'Colorado Avalanche': 'https://media.api-sports.io/hockey/teams/27.png',
  'Avalanche': 'https://media.api-sports.io/hockey/teams/27.png',
  'Vegas Golden Knights': 'https://media.api-sports.io/hockey/teams/63.png',
  'Golden Knights': 'https://media.api-sports.io/hockey/teams/63.png',
  'Edmonton Oilers': 'https://media.api-sports.io/hockey/teams/37.png',
  'Oilers': 'https://media.api-sports.io/hockey/teams/37.png',
  'New York Rangers': 'https://media.api-sports.io/hockey/teams/12.png',
  'Rangers': 'https://media.api-sports.io/hockey/teams/12.png',
  'Toronto Maple Leafs': 'https://media.api-sports.io/hockey/teams/25.png',
  'Maple Leafs': 'https://media.api-sports.io/hockey/teams/25.png',

  // MLB
  'New York Yankees': 'https://media.api-sports.io/baseball/teams/29.png',
  'Yankees': 'https://media.api-sports.io/baseball/teams/29.png',
  'Los Angeles Dodgers': 'https://media.api-sports.io/baseball/teams/27.png',
  'Dodgers': 'https://media.api-sports.io/baseball/teams/27.png',
  'Atlanta Braves': 'https://media.api-sports.io/baseball/teams/16.png',
  'Braves': 'https://media.api-sports.io/baseball/teams/16.png',
  'Houston Astros': 'https://media.api-sports.io/baseball/teams/24.png',
  'Astros': 'https://media.api-sports.io/baseball/teams/24.png',
  'Philadelphia Phillies': 'https://media.api-sports.io/baseball/teams/30.png',
  'Phillies': 'https://media.api-sports.io/baseball/teams/30.png',
}

// Generate fallback initials
function getInitials(name: string): string {
  const words = name.split(' ')
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Generate consistent color from team name
function getColorFromName(name: string): string {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500',
    'bg-orange-500', 'bg-teal-500', 'bg-emerald-500', 'bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[8px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

export function TeamLogo({ 
  teamName, 
  teamId, 
  leagueId,
  logoUrl: providedLogoUrl,
  size = 'md', 
  className,
  showFallback = true,
  variant,
  sportSlug,
  countryCode,
}: TeamLogoProps) {
  const [hasError, setHasError] = useState(false)
  // Resolve a logo URL in priority order:
  //   1. Caller-provided URL (e.g. ESPN team payload)
  //   2. Curated static map by name
  //   3. ESPN CDN guess by team id (covers most soccer/NBA/NFL teams the
  //      curated map doesn't list — works because ESPN serves logos at
  //      a deterministic path keyed by team id).
  // Build sport-aware ESPN CDN URL: the subfolder varies by sport slug.
  const espnSportFolder = (() => {
    if (!sportSlug) return 'soccer'
    const s = sportSlug.toLowerCase()
    if (s === 'basketball' || s === 'nba') return 'nba'
    if (s === 'american-football' || s === 'nfl') return 'nfl'
    if (s === 'baseball' || s === 'mlb') return 'mlb'
    if (s === 'ice-hockey' || s === 'hockey' || s === 'nhl') return 'nhl'
    if (s === 'tennis') return 'tennis'
    return 'soccer'
  })()
  const cdnGuessUrl = teamId
    ? `https://a.espncdn.com/i/teamlogos/${espnSportFolder}/500/${teamId}.png`
    : undefined
  const logoUrl = providedLogoUrl || TEAM_LOGOS[teamName] || cdnGuessUrl
  // Auto-pick athlete variant for individual sports.
  const effectiveVariant = variant ?? (isIndividualSport(sportSlug) ? 'athlete' : 'team')
  const isAthlete = effectiveVariant === 'athlete'

  // Use image if available and no error
  if (logoUrl && !hasError) {
    return (
      <div className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        isAthlete ? "bg-muted ring-1 ring-border" : "bg-muted",
        sizeClasses[size],
        className
      )}>
        <Image
          src={logoUrl}
          alt={teamName}
          fill
          className={isAthlete ? "object-cover" : "object-contain p-0.5"}
          onError={() => setHasError(true)}
          unoptimized
        />
      </div>
    )
  }
  
  // Fallback to initials. For "small league" teams (where ESPN often has no
  // crest), if we know the country we render a tiny flag chip in the corner
  // so users still get a regional cue ("oh, that's a Kenyan side") instead of
  // a meaningless coloured circle.
  if (showFallback) {
    const initials = getInitials(teamName)
    const bgColor = getColorFromName(teamName)
    // Flag chip is only useful for non-tiny avatars; on xs it would be
    // illegible and make the badge feel cluttered.
    const showFlag = !!countryCode && size !== 'xs'

    return (
      <div className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        sizeClasses[size],
        bgColor,
        className
      )}>
        {initials}
        {showFlag && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 overflow-hidden rounded-sm ring-1 ring-background",
              size === 'sm' ? "h-3 w-4" : size === 'md' ? "h-3.5 w-5" : "h-4 w-6",
            )}
            aria-hidden
          >
            <FlagIcon countryCode={countryCode!} className="h-full w-full" />
          </span>
        )}
      </div>
    )
  }
  
  return null
}

// Sport icon component using SVGs for consistent look
interface SportIconProps {
  sportSlug: string
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

const iconSizeClasses = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

// SVG Sport Icons
const SportSVGIcons: Record<string, React.FC<{ className?: string }>> = {
  'football': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20"/>
      <path d="M12 8l4 2.5v5L12 18l-4-2.5v-5z"/>
      <path d="M12 2v6M12 18v4M2 12h6M18 12h4"/>
    </svg>
  ),
  'basketball': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2v20M2 12h20"/>
      <path d="M4.93 4.93c4.08 2.35 6.15 6.07 6.15 11.07"/>
      <path d="M19.07 4.93c-4.08 2.35-6.15 6.07-6.15 11.07"/>
    </svg>
  ),
  'tennis': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M17 12c0-4-2-7-5-7s-5 3-5 7 2 7 5 7 5-3 5-7z"/>
      <path d="M2 12h20"/>
    </svg>
  ),
  'cricket': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20l8-8M12 12l8-8"/>
      <circle cx="19" cy="5" r="2"/>
      <path d="M2 22l2-2"/>
    </svg>
  ),
  'american-football': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(45 12 12)"/>
      <path d="M12 2v20M2 12h20"/>
    </svg>
  ),
  'baseball': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M5 5.5S8.5 8 8.5 12s-3.5 6.5-3.5 6.5"/>
      <path d="M19 5.5S15.5 8 15.5 12s3.5 6.5 3.5 6.5"/>
    </svg>
  ),
  'ice-hockey': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 16l6-6 4 4 6-6"/>
      <circle cx="12" cy="18" r="3"/>
      <path d="M2 22h20"/>
    </svg>
  ),
  'rugby': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(45 12 12)"/>
      <path d="M7 17L17 7"/>
    </svg>
  ),
  'mma': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l-6 6v4h4l6-6"/>
      <path d="M11 9l6-6v-1h-4l-6 6"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  'boxing': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/>
      <path d="M14 8h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/>
      <path d="M6 4v4M18 4v4"/>
    </svg>
  ),
  'formula-1': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 17h18"/>
      <path d="M5 17V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>
  ),
  'golf': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v17"/>
      <path d="M12 3l7 4-7 3"/>
      <circle cx="12" cy="20" r="2"/>
    </svg>
  ),
  'esports': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <path d="M6 12h4M8 10v4"/>
      <circle cx="16" cy="10" r="1"/>
      <circle cx="18" cy="12" r="1"/>
    </svg>
  ),
  'volleyball': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 10"/>
      <path d="M12 12a10 10 0 0 0 10 0"/>
      <path d="M2 12a10 10 0 0 0 10 10"/>
    </svg>
  ),
  'handball': ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2v10l6 6"/>
    </svg>
  ),
}

export function SportIcon({ sportSlug, size = 'md', className }: SportIconProps) {
  const normalizedSlug = sportSlug.toLowerCase().replace(/\s+/g, '-')
  const IconComponent = SportSVGIcons[normalizedSlug]
  
  if (IconComponent) {
    return (
      <div className={cn(iconSizeClasses[size], 'text-muted-foreground', className)}>
        <IconComponent className="h-full w-full" />
      </div>
    )
  }
  
  // Fallback to emoji for sports without SVG icons
  const SPORT_EMOJIS: Record<string, string> = {
    'football': '⚽',
    'soccer': '⚽',
    'basketball': '🏀',
    'tennis': '🎾',
    'cricket': '🏏',
    'american-football': '🏈',
    'baseball': '⚾',
    'ice-hockey': '🏒',
    'rugby': '🏉',
    'volleyball': '🏐',
    'handball': '🤾',
    'golf': '⛳',
    'boxing': '🥊',
    'mma': '🥋',
    'formula-1': '🏎️',
    'horse-racing': '🏇',
    'esports': '🎮',
    'table-tennis': '🏓',
    'badminton': '🏸',
    'cycling': '🚴',
    'swimming': '🏊',
    'darts': '🎯',
    'snooker': '🎱',
    'chess': '♟️',
    'futsal': '⚽',
    'water-polo': '🤽',
    'field-hockey': '🏑',
    'beach-volleyball': '🏐',
    'lacrosse': '🥍',
    'aussie-rules': '🏉',
    'squash': '🎾',
    'athletics': '🏃',
    'wrestling': '🤼',
    'nascar': '🏎️',
    'motogp': '🏍️',
    'ski-jumping': '⛷️',
  }
  
  const emoji = SPORT_EMOJIS[normalizedSlug] || '🏆'
  
  const emojiSizeClasses = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }
  
  return (
    <span className={cn(emojiSizeClasses[size], className)} role="img" aria-label={sportSlug}>
      {emoji}
    </span>
  )
}

// League logo component
interface LeagueLogoProps {
  leagueName: string
  leagueId?: number
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

// League logo URLs
const LEAGUE_LOGOS: Record<string, string> = {
  // Football - Top Leagues
  'Premier League': 'https://media.api-sports.io/football/leagues/39.png',
  'La Liga': 'https://media.api-sports.io/football/leagues/140.png',
  'Bundesliga': 'https://media.api-sports.io/football/leagues/78.png',
  'Serie A': 'https://media.api-sports.io/football/leagues/135.png',
  'Ligue 1': 'https://media.api-sports.io/football/leagues/61.png',
  'Eredivisie': 'https://media.api-sports.io/football/leagues/88.png',
  'Primeira Liga': 'https://media.api-sports.io/football/leagues/94.png',
  'Scottish Premiership': 'https://media.api-sports.io/football/leagues/179.png',
  'Champions League': 'https://media.api-sports.io/football/leagues/2.png',
  'UEFA Champions League': 'https://media.api-sports.io/football/leagues/2.png',
  'Europa League': 'https://media.api-sports.io/football/leagues/3.png',
  'UEFA Europa League': 'https://media.api-sports.io/football/leagues/3.png',
  'MLS': 'https://media.api-sports.io/football/leagues/253.png',
  'Brazilian Serie A': 'https://media.api-sports.io/football/leagues/71.png',
  'Argentine Primera Division': 'https://media.api-sports.io/football/leagues/128.png',
  'Saudi Pro League': 'https://media.api-sports.io/football/leagues/307.png',
  'Turkish Super Lig': 'https://media.api-sports.io/football/leagues/203.png',
  'Belgian Pro League': 'https://media.api-sports.io/football/leagues/144.png',
  'Russian Premier League': 'https://media.api-sports.io/football/leagues/235.png',
  'J1 League': 'https://media.api-sports.io/football/leagues/98.png',
  'K League 1': 'https://media.api-sports.io/football/leagues/292.png',
  'A-League': 'https://media.api-sports.io/football/leagues/188.png',
  'CAF Champions League': 'https://media.api-sports.io/football/leagues/12.png',
  'Kenya Premier League': 'https://media.api-sports.io/football/leagues/276.png',
  'Egyptian Premier League': 'https://media.api-sports.io/football/leagues/233.png',
  'Copa Libertadores': 'https://media.api-sports.io/football/leagues/13.png',
  
  // Basketball
  'NBA': 'https://media.api-sports.io/basketball/leagues/12.png',
  'EuroLeague': 'https://media.api-sports.io/basketball/leagues/120.png',
  'NBL': 'https://media.api-sports.io/basketball/leagues/25.png',
  
  // American Sports
  'NFL': 'https://media.api-sports.io/american-football/leagues/1.png',
  'NCAAF': 'https://media.api-sports.io/american-football/leagues/2.png',
  'MLB': 'https://media.api-sports.io/baseball/leagues/1.png',
  'NHL': 'https://media.api-sports.io/hockey/leagues/57.png',
  
  // Tennis
  'ATP Tour': 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/ATP_Tour_logo.svg/150px-ATP_Tour_logo.svg.png',
  'WTA Tour': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6a/WTA_logo.svg/150px-WTA_logo.svg.png',
  
  // Combat Sports
  'UFC': 'https://media.api-sports.io/mma/leagues/1.png',
  
  // Motorsport
  'Formula 1': 'https://media.api-sports.io/formula-1/leagues/1.png',
  'F1': 'https://media.api-sports.io/formula-1/leagues/1.png',
}

export function LeagueLogo({ leagueName, leagueId, size = 'md', className }: LeagueLogoProps) {
  const [hasError, setHasError] = useState(false)
  const logoUrl = LEAGUE_LOGOS[leagueName]
  
  if (logoUrl && !hasError) {
    return (
      <div className={cn(
        "relative shrink-0 overflow-hidden rounded bg-muted",
        sizeClasses[size],
        className
      )}>
        <Image
          src={logoUrl}
          alt={leagueName}
          fill
          className="object-contain p-0.5"
          onError={() => setHasError(true)}
          unoptimized
        />
      </div>
    )
  }
  
  // Fallback to first letter with color
  const initial = leagueName.charAt(0).toUpperCase()
  const bgColor = getColorFromName(leagueName)
  
  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center rounded font-bold text-white",
      sizeClasses[size],
      bgColor,
      className
    )}>
      {initial}
    </div>
  )
}

// League flag component
interface LeagueFlagProps {
  countryCode: string
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

export function LeagueFlag({ countryCode, size = 'md', className }: LeagueFlagProps) {
  // Render real flag images via flagcdn.com (with subdivision support for
  // GB-ENG/SCT/WLS/NIR). Replaces the older emoji output that displayed
  // inconsistently across platforms (notably country codes like ES, TR, IN
  // were rendered as plain text on some devices).
  // Map our internal sizes onto FlagIcon's sizing.
  const sizeMap: Record<typeof size, 'xs' | 'sm' | 'md' | 'lg'> = {
    xs: 'xs', sm: 'sm', md: 'md', lg: 'lg',
  }
  return <FlagIcon countryCode={countryCode} size={sizeMap[size]} className={className} />
}
