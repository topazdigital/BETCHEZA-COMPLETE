'use client'

import Link from 'next/link'
import { X, Trash2, ChevronDown, ChevronUp, Ticket, ExternalLink, Lightbulb } from 'lucide-react'
import { useBetSlip } from '@/contexts/bet-slip-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function BetSlipPanel() {
  const {
    selections, isOpen, setIsOpen,
    removeSelection, clearAll,
    accumOdds, stake, setStake, potentialReturn,
  } = useBetSlip()

  if (selections.length === 0) return null

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
                      Go to Bookmaker
                    </Link>
                    <span className="text-border">·</span>
                    <Link
                      href={`/matches/${s.matchSlug}?action=tip`}
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

            <Button size="sm" className="w-full font-bold text-sm h-9">
              Place Bet
            </Button>

            {/* Post as Tip */}
            {selections.length === 1 && selections[0].matchSlug && (
              <Link
                href={`/matches/${selections[0].matchSlug}?action=tip&outcome=${encodeURIComponent(selections[0].outcomeName)}&odds=${selections[0].price}`}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Post as Tip
              </Link>
            )}
            {selections.length > 1 && (
              <Link
                href="/tips/new"
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Post as Tip
              </Link>
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
