"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, ChevronDown, ChevronRight, Trophy, Globe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ALL_LEAGUES, ALL_SPORTS } from "@/lib/sports-data"
import { cn } from "@/lib/utils"

// ── Continent helpers ────────────────────────────────────────────────────────

const AFRICA = new Set(['Kenya','Egypt','Ghana','Nigeria','South Africa','Morocco','Tunisia','Algeria','Cameroon','Senegal',"Ivory Coast","Côte d'Ivoire",'Tanzania','Uganda','Zimbabwe','Zambia','Rwanda','Mozambique','Ethiopia','Liberia','Sierra Leone','Guinea','Africa'])
const EUROPE = new Set(['England','Spain','Germany','Italy','France','Netherlands','Portugal','Scotland','Belgium','Turkey','Russia','Switzerland','Austria','Romania','Greece','Czech Republic','Poland','Sweden','Norway','Denmark','Finland','Croatia','Serbia','Ukraine','Slovakia','Slovenia','Hungary','Bulgaria','Albania','Belarus','Iceland','Wales','Ireland','Northern Ireland','Bosnia-Herzegovina','Montenegro','North Macedonia','Kosovo','Luxembourg','Latvia','Lithuania','Estonia','Moldova','Europe'])
const AMERICAS = new Set(['USA','Brazil','Argentina','Mexico','Colombia','Peru','Chile','Ecuador','Uruguay','Paraguay','Venezuela','Bolivia','Costa Rica','El Salvador','Honduras','Guatemala','Dominican Republic','Panama','Cuba','Canada','Jamaica','Haiti','South America','North America'])
const ASIA = new Set(['Japan','South Korea','China','Saudi Arabia','Indonesia','Thailand','Malaysia','India','Qatar','UAE','United Arab Emirates','Kuwait','Jordan','Iraq','Iran','Pakistan','Bangladesh','Uzbekistan','Bahrain','Oman','Syria','Lebanon','Israel','Kazakhstan','Myanmar','Vietnam','Philippines','Singapore','Taiwan','Hong Kong','Sri Lanka','Nepal','Asia'])
const OCEANIA = new Set(['Australia','New Zealand','Fiji','Papua New Guinea','Oceania'])

function getContinent(country: string): string {
  if (AFRICA.has(country)) return 'Africa'
  if (EUROPE.has(country)) return 'Europe'
  if (AMERICAS.has(country)) return 'Americas'
  if (ASIA.has(country)) return 'Asia'
  if (OCEANIA.has(country)) return 'Oceania'
  return 'International'
}

const CONTINENT_ORDER = ['Africa','Europe','Americas','Asia','Oceania','International']
const CONTINENT_ICONS: Record<string,string> = {
  Africa: '🌍', Europe: '🌍', Americas: '🌎', Asia: '🌏', Oceania: '🌏', International: '🌐',
}

function getFlag(country: string, countryCode: string): string {
  const regions: Record<string, string> = {
    World: '🌍', International: '🌍', Europe: '🇪🇺', Africa: '🌍',
    'South America': '🌎', 'North America': '🌎', Asia: '🌏', Oceania: '🌏',
  }
  if (regions[country]) return regions[country]
  if (countryCode === 'GB-ENG') return '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
  if (countryCode === 'GB-SCT') return '🏴󠁧󠁢󠁳󠁣󠁴󠁿'
  if (countryCode === 'GB-WLS') return '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
  if (countryCode === 'EU') return '🇪🇺'
  const base = countryCode?.split('-')[0]
  if (base?.length === 2 && /^[A-Z]{2}$/.test(base)) {
    try {
      return String.fromCodePoint(
        0x1F1E6 + base.charCodeAt(0) - 65,
        0x1F1E6 + base.charCodeAt(1) - 65,
      )
    } catch { return '🌍' }
  }
  return '🌍'
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LeaguesBrowserPage() {
  const [search, setSearch] = useState('')
  const [activeSportId, setActiveSportId] = useState<number | null>(null)
  const [expandedContinents, setExpandedContinents] = useState<Set<string>>(
    new Set(CONTINENT_ORDER) // start all open
  )

  // Collect sport IDs that have at least one league
  const availableSports = useMemo(() => {
    const ids = new Set(ALL_LEAGUES.map(l => l.sportId))
    return ALL_SPORTS.filter(s => ids.has(s.id))
  }, [])

  // Filter leagues
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return ALL_LEAGUES.filter(l => {
      if (activeSportId && l.sportId !== activeSportId) return false
      if (q && !l.name.toLowerCase().includes(q) && !l.country.toLowerCase().includes(q)) return false
      return true
    })
  }, [search, activeSportId])

  // Group: continent → country → leagues
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, typeof ALL_LEAGUES>> = {}
    for (const l of filtered) {
      const continent = getContinent(l.country)
      if (!map[continent]) map[continent] = {}
      if (!map[continent][l.country]) map[continent][l.country] = []
      map[continent][l.country].push(l)
    }
    return map
  }, [filtered])

  const totalShown = filtered.length

  function toggleContinent(c: string) {
    setExpandedContinents(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const sportIcon = (id: number) => ALL_SPORTS.find(s => s.id === id)?.icon ?? '🏆'

  return (
    <main className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Leagues Browser</h1>
              <p className="text-sm text-muted-foreground">
                {totalShown} competitions across all sports and regions
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Search + sport filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leagues or countries…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Sport filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSportId(null)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors border",
              activeSportId === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
            )}
          >
            <Globe className="h-3 w-3" />
            All Sports
          </button>
          {availableSports.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSportId(activeSportId === s.id ? null : s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors border",
                activeSportId === s.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              )}
            >
              <span>{s.icon}</span>
              {s.name}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {totalShown === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <Trophy className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No leagues found</p>
            <p className="text-sm mt-1">Try a different search or sport filter</p>
          </div>
        )}

        {/* Continent sections */}
        {CONTINENT_ORDER.filter(c => grouped[c]).map(continent => {
          const countries = grouped[continent]
          const isOpen = expandedContinents.has(continent)
          const leagueCount = Object.values(countries).flat().length

          return (
            <section key={continent} className="rounded-xl border bg-card overflow-hidden">
              {/* Continent header */}
              <button
                onClick={() => toggleContinent(continent)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CONTINENT_ICONS[continent]}</span>
                  <div className="text-left">
                    <div className="font-bold text-base">{continent}</div>
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(countries).length} countries · {leagueCount} competitions
                    </div>
                  </div>
                </div>
                {isOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {/* Countries + leagues */}
              {isOpen && (
                <div className="border-t divide-y">
                  {Object.entries(countries)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([country, leagues]) => {
                      const flag = getFlag(country, leagues[0]?.countryCode ?? '')
                      return (
                        <div key={country} className="px-5 py-4">
                          {/* Country header */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg leading-none">{flag}</span>
                            <span className="font-semibold text-sm">{country}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {leagues.length}
                            </Badge>
                          </div>

                          {/* League cards grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {leagues.map(league => (
                              <Link
                                key={league.id}
                                href={`/leagues/${league.slug}`}
                                className="group flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 hover:border-primary/50 hover:bg-primary/5 transition-all"
                              >
                                <span className="text-lg shrink-0">{sportIcon(league.sportId)}</span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                    {league.name}
                                  </div>
                                  {league.tier === 1 && (
                                    <div className="text-[10px] text-amber-500 font-semibold">TOP FLIGHT</div>
                                  )}
                                </div>
                                <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}
