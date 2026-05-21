'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { X, Trash2, ChevronDown, ChevronUp, Ticket, ExternalLink, Lightbulb, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { useBetSlip } from '@/contexts/bet-slip-context'
import { useAuth } from '@/contexts/auth-context'
import { useAuthModal } from '@/contexts/auth-modal-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

export function BetSlipPanel() {
  const {
    selections, isOpen, setIsOpen,
    removeSelection, clearAll,
    accumOdds, stake, setStake, potentialReturn,
  } = useBetSlip()
  const { isAuthenticated, user } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const bookmakerFetcher = (url: string) => fetch(url).then(r => r.json())
  const { data: bookmakerData } = useSWR('/api/bookmakers', bookmakerFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60_000,
    refreshInterval: 0,
  })
  const defaultBookmakerUrl = bookmakerData?.bookmakers?.[0]?.affiliateUrl ?? null
  const defaultBookmakerName = bookmakerData?.bookmakers?.[0]?.name ?? 'Bookmaker'

  // Acca tip posting state
  const [showAccaForm, setShowAccaForm] = useState(false)
  const [accaAnalysis, setAccaAnalysis] = useState('')
  const [accaConfidence, setAccaConfidence] = useState(70)
  const [accaPosting, setAccaPosting] = useState(false)
  const [accaResult, setAccaResult] = useState<'success' | 'error' | null>(null)
  const [accaError, setAccaError] = useState('')


  if (selections.length === 0) return null

  const handlePostAsTip = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal('login')
    }
  }

  const handlePlaceBet = () => {
    const url = selections[0]?.bookmakerUrl || defaultBookmakerUrl
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else if (selections[0]?.matchSlug) {
      window.open(`/matches/${selections[0].matchSlug}#bookmakers`, '_self')
    }
  }

  // Build single-selection tip URL including marketKey for pre-fill
  const singleTipUrl = selections.length === 1 && selections[0].matchSlug
    ? `/matches/${selections[0].matchSlug}?action=tip&marketKey=${encodeURIComponent(selections[0].marketKey)}&outcome=${encodeURIComponent(selections[0].outcomeName)}&odds=${selections[0].price}`
    : '#'

  // Post an accumulator tip to the community feed
  const handlePostAcca = async () => {
    if (!isAuthenticated) { openAuthModal('login'); return }
    if (accaAnalysis.trim().length < 20) {
      setAccaError('Analysis must be at least 20 characters')
      return
    }
    setAccaPosting(true)
    setAccaError('')
    try {
      const legs = selections.map(s =>
        `• ${s.matchName}: **${s.outcomeName}** @ ${s.price.toFixed(2)}`
      ).join('\n')
      const content = `🎯 ${selections.length}-leg accumulator @ ${accumOdds.toFixed(2)}x odds\n\n${legs}\n\n${accaAnalysis.trim()}`
      const res = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          pick: `${selections.length}-Leg Acca`,
          odds: accumOdds,
        }),
      })
      if (res.ok) {
        setAccaResult('success')
        setAccaAnalysis('')
        setTimeout(() => {
          setShowAccaForm(false)
          setAccaResult(null)
        }, 2500)
      } else {
        const data = await res.json()
        setAccaError(data.error || 'Failed to post. Try again.')
        setAccaResult('error')
      }
    } catch {
      setAccaError('Network error. Please try again.')
      setAccaResult('error')
    } finally {
      setAccaPosting(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-2 sm:right-4 z-50 w-[calc(100vw-1rem)] max-w-xs shadow-2xl rounded-xl border border-border bg-background overflow-hidden animate-in slide-in-from-bottom-4">
      {/* Header toggle */}
      <button
        className="w-full flex items-center justify-between p-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4" />
          <span className="font-bold text-sm">Bet Slip</span>
          <Badge className="h-5 min-w-5 text-[10px] font-black bg-white/20 text-primary-foreground border-0 px-1.5">
            {selections.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-80 font-mono">{accumOdds.toFixed(2)}x</span>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </button>

      {isOpen && (
        <>
          {/* Selections list */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
            {selections.map((s) => (
              <div key={s.id} className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate leading-snug">{s.matchName}</p>
                    <p className="text-xs font-semibold truncate leading-snug">{s.outcomeName}</p>
                    <p className="text-[9px] text-muted-foreground/70 truncate">{s.marketName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <span className="text-sm font-black text-primary tabular-nums">{s.price.toFixed(2)}</span>
                    <button
                      onClick={() => removeSelection(s.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {/* Per-selection action row */}
                {s.matchSlug && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Link
                      href={`/matches/${s.matchSlug}#bookmakers`}
                      className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Compare Odds
                    </Link>
                    <span className="text-border">·</span>
                    <Link
                      href={isAuthenticated
                        ? `/matches/${s.matchSlug}?action=tip&marketKey=${encodeURIComponent(s.marketKey)}&outcome=${encodeURIComponent(s.outcomeName)}&odds=${s.price}`
                        : '#'}
                      onClick={isAuthenticated ? undefined : handlePostAsTip}
                      className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-600 transition-colors"
                    >
                      <Lightbulb className="h-3 w-3" />
                      Create Tip
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 space-y-2.5 border-t border-border bg-muted/20">
            {selections.length > 1 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Accumulator</span>
                <span className="font-black text-base tabular-nums">{accumOdds.toFixed(2)}x</span>
              </div>
            )}

            {/* Stake row */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Stake (KSh)</label>
              <Input
                type="number"
                value={stake}
                onChange={e => setStake(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-8 text-sm font-bold text-right"
                min={0}
              />
            </div>

            {/* Returns */}
            <div className="flex items-center justify-between rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">Potential Return</span>
              <span className="text-sm font-black text-green-600 dark:text-green-400 tabular-nums">
                KSh {potentialReturn.toFixed(2)}
              </span>
            </div>

            {/* Stake shortcuts */}
            <div className="grid grid-cols-4 gap-1">
              {[50, 100, 500, 1000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setStake(amt)}
                  className={cn(
                    'text-[10px] font-bold rounded px-1 py-1 border transition-colors',
                    stake === amt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
                  )}
                >
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>

            {/* Place Bet */}
            <Button
              size="sm"
              className="w-full font-bold text-sm h-9 gap-1.5"
              onClick={handlePlaceBet}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Place Bet on {selections[0]?.bookmakerName || defaultBookmakerName}
            </Button>

            {/* Post as Tip — single selection: go to match page pre-filled */}
            {selections.length === 1 && selections[0].matchSlug && (
              <Link
                href={isAuthenticated ? singleTipUrl : '#'}
                onClick={isAuthenticated ? undefined : handlePostAsTip}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Post as Tip
              </Link>
            )}

            {/* Post Accumulator Tip — multi-selection: inline form */}
            {selections.length > 1 && (
              <div>
                {!showAccaForm ? (
                  <button
                    onClick={() => { if (!isAuthenticated) { openAuthModal('login'); return } setShowAccaForm(true); setAccaResult(null) }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 transition-colors"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    Post Acca Tip to Community
                  </button>
                ) : (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                        Post {selections.length}-leg acca @ {accumOdds.toFixed(2)}x
                      </p>
                      <button onClick={() => { setShowAccaForm(false); setAccaResult(null); setAccaError('') }} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Legs preview */}
                    <div className="space-y-0.5">
                      {selections.map(s => (
                        <p key={s.id} className="text-[9px] text-muted-foreground truncate">
                          <span className="font-semibold text-foreground">{s.outcomeName}</span>
                          {' '}@ {s.price.toFixed(2)} · <span className="text-muted-foreground/60">{s.matchName}</span>
                        </p>
                      ))}
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Confidence</span>
                      <input
                        type="range"
                        min={50} max={100} step={5}
                        value={accaConfidence}
                        onChange={e => setAccaConfidence(Number(e.target.value))}
                        className="flex-1 h-1 accent-amber-500"
                      />
                      <span className="text-[10px] font-bold text-amber-600 w-8 text-right">{accaConfidence}%</span>
                    </div>

                    {/* Analysis */}
                    <Textarea
                      placeholder="Why are you backing this acca? (min 20 chars)"
                      value={accaAnalysis}
                      onChange={e => { setAccaAnalysis(e.target.value); setAccaError('') }}
                      className="text-xs min-h-[60px] resize-none"
                      maxLength={500}
                    />
                    <p className="text-[9px] text-muted-foreground text-right">{accaAnalysis.length}/500</p>

                    {accaError && (
                      <p className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {accaError}
                      </p>
                    )}

                    {accaResult === 'success' ? (
                      <div className="flex items-center justify-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/20 py-1.5 text-xs font-semibold text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Posted to community feed!
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400 font-bold"
                        onClick={handlePostAcca}
                        disabled={accaPosting}
                      >
                        <Send className="h-3 w-3" />
                        {accaPosting ? 'Posting…' : 'Post to Community Feed'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={clearAll}
              className="w-full text-[10px] text-muted-foreground hover:text-destructive flex items-center justify-center gap-1 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          </div>
        </>
      )}
    </div>
  )
}
