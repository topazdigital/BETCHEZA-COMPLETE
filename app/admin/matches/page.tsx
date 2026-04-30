"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Plus, MoreHorizontal, Edit, Trash2, Loader2, X, CheckCircle2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ALL_SPORTS, ALL_LEAGUES, TEAMS_DATABASE } from "@/lib/sports-data"
import { format } from "date-fns"
import { matchIdToSlug } from "@/lib/utils/match-url"

interface Match {
  id: number | string
  home_team_name: string
  away_team_name: string
  home_team_logo?: string | null
  away_team_logo?: string | null
  league_name: string
  sport_name: string
  sport_icon: string
  status: string
  home_score: number | null
  away_score: number | null
  kickoff_time: string
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [source, setSource] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sportFilter, setSportFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  const [newMatch, setNewMatch] = useState({
    sportId: "", leagueId: "", homeTeamId: "", awayTeamId: "",
    kickoffDate: "", kickoffTime: "",
    homeOdds: "", drawOdds: "", awayOdds: "",
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const r = await fetch('/api/admin/matches?limit=200')
        const data = await r.json()
        if (cancelled) return
        setMatches(data.matches || [])
        setSource(data.source || "")
      } catch (e) {
        console.error('Failed loading matches', e)
        if (!cancelled) setMatches([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const filteredMatches = matches.filter((match) => {
    if (searchQuery && 
        !match.home_team_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !match.away_team_name.toLowerCase().includes(searchQuery.toLowerCase())
    ) return false
    if (sportFilter !== "all" && match.sport_name !== sportFilter) return false
    if (statusFilter !== "all" && match.status !== statusFilter) return false
    return true
  })

  const filteredLeagues = newMatch.sportId
    ? ALL_LEAGUES.filter(l => l.sportId === parseInt(newMatch.sportId))
    : []

  const filteredTeams = newMatch.leagueId
    ? TEAMS_DATABASE.filter(t => t.leagueId === parseInt(newMatch.leagueId))
    : []

  const handleAddMatch = async () => {
    if (!newMatch.leagueId || !newMatch.homeTeamId || !newMatch.awayTeamId || !newMatch.kickoffDate || !newMatch.kickoffTime) {
      setSaveMessage("Please fill in all required fields")
      return
    }
    setIsSaving(true)
    setSaveMessage("")
    try {
      const kickoffTime = `${newMatch.kickoffDate}T${newMatch.kickoffTime}:00`
      const response = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: parseInt(newMatch.leagueId),
          homeTeamId: parseInt(newMatch.homeTeamId),
          awayTeamId: parseInt(newMatch.awayTeamId),
          kickoffTime,
          homeOdds: newMatch.homeOdds ? parseFloat(newMatch.homeOdds) : undefined,
          drawOdds: newMatch.drawOdds ? parseFloat(newMatch.drawOdds) : undefined,
          awayOdds: newMatch.awayOdds ? parseFloat(newMatch.awayOdds) : undefined,
        }),
      })
      if (response.ok) {
        setSaveMessage("Match created successfully!")
        const homeTeam = TEAMS_DATABASE.find(t => t.id === parseInt(newMatch.homeTeamId))
        const awayTeam = TEAMS_DATABASE.find(t => t.id === parseInt(newMatch.awayTeamId))
        const league = ALL_LEAGUES.find(l => l.id === parseInt(newMatch.leagueId))
        const sport = ALL_SPORTS.find(s => s.id === parseInt(newMatch.sportId))
        const newMatchData: Match = {
          id: Date.now(),
          home_team_name: homeTeam?.name || 'Home Team',
          away_team_name: awayTeam?.name || 'Away Team',
          league_name: league?.name || 'League',
          sport_name: sport?.name || 'Football',
          sport_icon: sport?.icon || '⚽',
          status: 'scheduled',
          home_score: null,
          away_score: null,
          kickoff_time: kickoffTime,
        }
        setMatches(prev => [newMatchData, ...prev])
        setTimeout(() => {
          setShowAddDialog(false)
          setNewMatch({ sportId: "", leagueId: "", homeTeamId: "", awayTeamId: "", kickoffDate: "", kickoffTime: "", homeOdds: "", drawOdds: "", awayOdds: "" })
          setSaveMessage("")
        }, 1200)
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create match')
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to create match')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteMatch = async (matchId: number | string) => {
    if (!confirm('Are you sure you want to delete this match?')) return
    try {
      await fetch(`/api/admin/matches?id=${matchId}`, { method: 'DELETE' })
      setMatches(prev => prev.filter(m => m.id !== matchId))
    } catch (error) {
      console.error('Failed to delete match:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            Matches
            {source && <Badge variant="secondary" className="text-[10px]">{source === 'live' ? 'Live ESPN feed' : source}</Badge>}
          </h1>
          <p className="text-xs text-muted-foreground">Add matches manually or browse the live feed</p>
        </div>
        <Button className="gap-1.5" onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add match
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Total</div><div className="text-base font-bold tabular-nums">{matches.length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Live</div><div className="text-base font-bold tabular-nums text-rose-600">{matches.filter(m => m.status === 'live').length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Scheduled</div><div className="text-base font-bold tabular-nums text-blue-600">{matches.filter(m => m.status === 'scheduled').length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Finished</div><div className="text-base font-bold tabular-nums text-emerald-600">{matches.filter(m => m.status === 'finished').length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search matches…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 text-xs" />
            </div>
            <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
              <option value="all">All sports</option>
              {Array.from(new Set(matches.map(m => m.sport_name))).slice(0, 20).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
              <option value="all">All status</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
                  <th className="p-2">Match</th>
                  <th className="p-2">Sport</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Kickoff</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((match) => (
                  <tr key={String(match.id)} className="border-b hover:bg-muted/30">
                    <td className="p-2">
                      <Link href={`/matches/${matchIdToSlug(String(match.id))}`} className="hover:text-primary">
                        <p className="font-semibold">{match.home_team_name} <span className="text-muted-foreground">vs</span> {match.away_team_name}</p>
                        <p className="text-[10px] text-muted-foreground">{match.league_name}</p>
                      </Link>
                    </td>
                    <td className="p-2">
                      <span className="text-base mr-1">{match.sport_icon}</span>
                      <span className="text-[11px]">{match.sport_name}</span>
                    </td>
                    <td className="p-2">
                      <Badge variant={match.status === 'live' ? 'destructive' : match.status === 'finished' ? 'default' : 'secondary'} className="text-[10px]">
                        {match.status}
                      </Badge>
                    </td>
                    <td className="p-2 font-bold tabular-nums">
                      {match.home_score !== null ? `${match.home_score}–${match.away_score}` : '—'}
                    </td>
                    <td className="p-2 text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(match.kickoff_time), 'MMM d, HH:mm')}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link href={`/matches/${matchIdToSlug(String(match.id))}`} className="text-muted-foreground hover:text-primary p-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Edit className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMatch(match.id)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMatches.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">No matches match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add match</DialogTitle>
            <DialogDescription>Create a new match by selecting the sport, league and teams.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sport *</Label>
                <select value={newMatch.sportId} onChange={(e) => setNewMatch({ ...newMatch, sportId: e.target.value, leagueId: '', homeTeamId: '', awayTeamId: '' })} className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs">
                  <option value="">Select sport</option>
                  {ALL_SPORTS.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">League *</Label>
                <select value={newMatch.leagueId} onChange={(e) => setNewMatch({ ...newMatch, leagueId: e.target.value, homeTeamId: '', awayTeamId: '' })} disabled={!newMatch.sportId} className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50">
                  <option value="">Select league</option>
                  {filteredLeagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Home Team *</Label>
                <select value={newMatch.homeTeamId} onChange={(e) => setNewMatch({ ...newMatch, homeTeamId: e.target.value })} disabled={!newMatch.leagueId} className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50">
                  <option value="">Select home team</option>
                  {filteredTeams.filter(t => t.id.toString() !== newMatch.awayTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Away Team *</Label>
                <select value={newMatch.awayTeamId} onChange={(e) => setNewMatch({ ...newMatch, awayTeamId: e.target.value })} disabled={!newMatch.leagueId} className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50">
                  <option value="">Select away team</option>
                  {filteredTeams.filter(t => t.id.toString() !== newMatch.homeTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={newMatch.kickoffDate} onChange={(e) => setNewMatch({ ...newMatch, kickoffDate: e.target.value })} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time *</Label>
                <Input type="time" value={newMatch.kickoffTime} onChange={(e) => setNewMatch({ ...newMatch, kickoffTime: e.target.value })} className="h-9 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Home odds</Label><Input type="number" step="0.01" placeholder="2.10" value={newMatch.homeOdds} onChange={(e) => setNewMatch({ ...newMatch, homeOdds: e.target.value })} className="h-9 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Draw odds</Label><Input type="number" step="0.01" placeholder="3.40" value={newMatch.drawOdds} onChange={(e) => setNewMatch({ ...newMatch, drawOdds: e.target.value })} className="h-9 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Away odds</Label><Input type="number" step="0.01" placeholder="3.10" value={newMatch.awayOdds} onChange={(e) => setNewMatch({ ...newMatch, awayOdds: e.target.value })} className="h-9 text-xs" /></div>
            </div>

            {saveMessage && (
              <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${saveMessage.includes('success') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {saveMessage.includes('success') ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                {saveMessage}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddMatch} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Creating…</> : <><Plus className="mr-2 h-3.5 w-3.5" />Create</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
