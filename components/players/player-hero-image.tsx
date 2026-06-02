'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'

interface PlayerHeroImageProps {
  headshot?: string | null
  name: string
  id?: string | number | null
  sport?: string | null
  className?: string
  fallbackClassName?: string
  size?: number
}

export function PlayerHeroImage({
  headshot, name, id, sport,
  className,
  fallbackClassName,
  size = 128,
}: PlayerHeroImageProps) {
  const espnSport = !sport ? 'soccer' : sport === 'football' ? 'soccer' : sport

  const sources = useMemo(() => {
    const out: string[] = []
    if (headshot) out.push(headshot)
    if (id) {
      const sId = String(id)
      out.push(`https://a.espncdn.com/i/headshots/${espnSport}/players/full/${sId}.png`)
      out.push(`https://a.espncdn.com/i/headshots/${espnSport}/players/default/${sId}.png`)
    }
    return out.filter((s, i, arr) => arr.indexOf(s) === i)
  }, [headshot, id, espnSport])

  const [srcIdx, setSrcIdx] = useState(0)
  const currentSrc = sources[srcIdx]
  const exhausted = srcIdx >= sources.length || !currentSrc

  if (exhausted) {
    return (
      <div className={fallbackClassName || 'flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-4xl font-bold text-primary shadow-md sm:h-32 sm:w-32'}>
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <Image
      src={currentSrc}
      alt={name}
      width={size}
      height={size}
      className={className || 'h-28 w-28 rounded-2xl border border-border bg-muted object-cover shadow-md sm:h-32 sm:w-32'}
      unoptimized
      onError={() => setSrcIdx((i) => i + 1)}
    />
  )
}
