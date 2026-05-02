'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface BetSelection {
  id: string
  matchId: string
  matchName: string
  matchSlug: string
  marketKey: string
  marketName: string
  outcomeName: string
  price: number
}

interface BetSlipContextType {
  selections: BetSelection[]
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  addSelection: (s: Omit<BetSelection, 'id'>) => void
  removeSelection: (id: string) => void
  clearAll: () => void
  isSelected: (matchId: string, marketKey: string, outcomeName: string) => boolean
  accumOdds: number
  stake: number
  setStake: (n: number) => void
  potentialReturn: number
}

const BetSlipContext = createContext<BetSlipContextType | null>(null)

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [stake, setStake] = useState(10)

  const addSelection = useCallback((s: Omit<BetSelection, 'id'>) => {
    const id = `${s.matchId}__${s.marketKey}__${s.outcomeName}`
    setSelections(prev => {
      const sameMarket = prev.filter(x => x.matchId === s.matchId && x.marketKey === s.marketKey)
      if (sameMarket.some(x => x.id === id)) {
        return prev.filter(x => x.id !== id)
      }
      const filtered = prev.filter(x => !(x.matchId === s.matchId && x.marketKey === s.marketKey))
      return [...filtered, { ...s, id }]
    })
    setIsOpen(true)
  }, [])

  const removeSelection = useCallback((id: string) => {
    setSelections(prev => prev.filter(x => x.id !== id))
  }, [])

  const clearAll = useCallback(() => setSelections([]), [])

  const isSelected = useCallback((matchId: string, marketKey: string, outcomeName: string) => {
    const id = `${matchId}__${marketKey}__${outcomeName}`
    return selections.some(s => s.id === id)
  }, [selections])

  const accumOdds = selections.length > 0 ? selections.reduce((acc, s) => acc * s.price, 1) : 1
  const potentialReturn = stake * accumOdds

  return (
    <BetSlipContext.Provider value={{
      selections, isOpen, setIsOpen, addSelection, removeSelection, clearAll,
      isSelected, accumOdds, stake, setStake, potentialReturn,
    }}>
      {children}
    </BetSlipContext.Provider>
  )
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext)
  if (!ctx) throw new Error('useBetSlip must be used within BetSlipProvider')
  return ctx
}
