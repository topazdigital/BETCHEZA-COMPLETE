"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { playerHref } from "@/lib/utils/slug"

type PlayerAvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

const SIZE_PX: Record<PlayerAvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 44,
  xl: 64,
}

const SIZE_TEXT: Record<PlayerAvatarSize, string> = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs",
  xl: "text-base",
}

export interface PlayerAvatarProps {
  /** Player full name (used for initials and tooltip) */
  name?: string
  /** Player ESPN id — when present, the avatar links to /players/{id} */
  id?: string | number
  /** Direct headshot URL — usually `https://a.espncdn.com/i/headshots/<sport>/players/full/<id>.png` */
  headshot?: string
  /** Sport slug used to build a fallback ESPN headshot URL when no headshot is provided */
  sport?: string
  /** Jersey number — shown as a small chip on the avatar (when image loads) or as the placeholder content */
  jersey?: string | number
  /** Avatar size */
  size?: PlayerAvatarSize
  /** Tailwind classes added to the wrapper element */
  className?: string
  /** Tailwind classes for the round image/placeholder */
  imgClassName?: string
  /** When true, never render as a Link even if `id` is set */
  noLink?: boolean
  /** Optional extra ring style */
  ring?: "none" | "border" | "primary" | "blue" | "red"
}

function ringClass(ring: PlayerAvatarProps["ring"]) {
  switch (ring) {
    case "primary":
      return "ring-2 ring-primary/40"
    case "blue":
      return "ring-2 ring-blue-400/80"
    case "red":
      return "ring-2 ring-red-400/80"
    case "border":
      return "ring-1 ring-border"
    default:
      return ""
  }
}

/**
 * Small, deterministic colour for the initials fallback so the same player
 * always gets the same colour (helps spot the same person across pages).
 */
function colorFromName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xfffffff
  }
  const palette = [
    "from-blue-500 to-blue-700",
    "from-emerald-500 to-emerald-700",
    "from-amber-500 to-amber-700",
    "from-rose-500 to-rose-700",
    "from-violet-500 to-violet-700",
    "from-cyan-500 to-cyan-700",
    "from-orange-500 to-orange-700",
    "from-fuchsia-500 to-fuchsia-700",
    "from-teal-500 to-teal-700",
    "from-indigo-500 to-indigo-700",
  ]
  return palette[h % palette.length]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PlayerAvatar({
  name = "",
  id,
  headshot,
  sport = "soccer",
  jersey,
  size = "md",
  className,
  imgClassName,
  noLink = false,
  ring = "border",
}: PlayerAvatarProps) {
  const px = SIZE_PX[size]
  const textCls = SIZE_TEXT[size]

  // Build a chain of headshot URLs to try, falling back as each 404s.
  // 1. Whatever the caller provided.
  // 2. ESPN's stable per-id "full" headshot for the sport (PNG).
  // 3. ESPN's stable per-id "default" headshot for the sport (PNG, smaller).
  // 4. Initials placeholder.
  const sources = useMemo(() => {
    const out: string[] = []
    if (headshot) out.push(headshot)
    if (id) {
      const sId = String(id)
      const espnSport = sport === "football" ? "soccer" : sport
      out.push(
        `https://a.espncdn.com/i/headshots/${espnSport}/players/full/${sId}.png`,
      )
      out.push(
        `https://a.espncdn.com/i/headshots/${espnSport}/players/default/${sId}.png`,
      )
    }
    return out.filter((s, i, arr) => arr.indexOf(s) === i)
  }, [headshot, id, sport])

  const [srcIdx, setSrcIdx] = useState(0)
  const currentSrc = sources[srcIdx]
  const exhausted = srcIdx >= sources.length

  const initials = name ? initialsFromName(name) : jersey ? String(jersey) : "?"
  const gradient = colorFromName(name || String(id || "x"))

  const placeholder = (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br text-white font-bold shadow-sm",
        gradient,
        textCls,
        ringClass(ring),
        imgClassName,
      )}
      style={{ width: px, height: px }}
      aria-label={name}
    >
      {initials}
    </div>
  )

  const inner = (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: px, height: px }}
      title={name || undefined}
    >
      {!exhausted && currentSrc ? (
        <Image
          src={currentSrc}
          alt={name || "Player"}
          width={px}
          height={px}
          className={cn(
            "rounded-full object-cover bg-muted",
            ringClass(ring),
            imgClassName,
          )}
          onError={() => setSrcIdx((i) => i + 1)}
          unoptimized
        />
      ) : (
        placeholder
      )}
      {jersey !== undefined && jersey !== "" && !exhausted && currentSrc && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-black text-white bg-primary border border-white/70 shadow"
        >
          {jersey}
        </span>
      )}
    </span>
  )

  if (id && !noLink) {
    return (
      <Link
        href={playerHref(name, id)}
        className="inline-flex items-center"
        aria-label={`View ${name}'s profile`}
      >
        {inner}
      </Link>
    )
  }
  return inner
}
