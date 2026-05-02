'use client'

import { useEffect, useRef, useCallback } from 'react'

export type LiveSoundEvent = 'goal' | 'card' | 'whistle' | 'kickoff' | 'follow_goal'

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainVal = 0.3,
  startAt = 0,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + startAt)
  gain.gain.setValueAtTime(gainVal, ctx.currentTime + startAt)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration)
  osc.start(ctx.currentTime + startAt)
  osc.stop(ctx.currentTime + startAt + duration + 0.05)
}

function synthesizeGoal(ctx: AudioContext) {
  // Crowd roar simulation: layered sine waves
  for (let i = 0; i < 3; i++) {
    playTone(ctx, 200 + i * 80, 0.8, 'sine', 0.15 - i * 0.03, i * 0.08)
    playTone(ctx, 400 + i * 60, 0.5, 'triangle', 0.1, i * 0.1)
  }
  // Stutter excitement effect
  playTone(ctx, 880, 0.15, 'square', 0.2, 0)
  playTone(ctx, 1100, 0.12, 'square', 0.18, 0.18)
  playTone(ctx, 990, 0.14, 'square', 0.1, 0.35)
}

function synthesizeFollowGoal(ctx: AudioContext) {
  // More dramatic version for followed team goals
  for (let i = 0; i < 5; i++) {
    playTone(ctx, 300 + i * 100, 1.2, 'sine', 0.2 - i * 0.02, i * 0.06)
  }
  playTone(ctx, 1320, 0.2, 'square', 0.25, 0)
  playTone(ctx, 1760, 0.18, 'square', 0.2, 0.25)
  playTone(ctx, 1320, 0.15, 'square', 0.15, 0.5)
}

function synthesizeCard(ctx: AudioContext) {
  // Short sharp whistle-like tone
  playTone(ctx, 1200, 0.15, 'triangle', 0.3, 0)
  playTone(ctx, 900, 0.1, 'triangle', 0.2, 0.2)
}

function synthesizeWhistle(ctx: AudioContext) {
  // Referee whistle: short high-pitched sine burst
  playTone(ctx, 2000, 0.12, 'sine', 0.4, 0)
  playTone(ctx, 2200, 0.08, 'sine', 0.3, 0.14)
}

function synthesizeKickoff(ctx: AudioContext) {
  // Three short whistles
  for (let i = 0; i < 3; i++) {
    playTone(ctx, 1800 + i * 100, 0.1, 'sine', 0.35, i * 0.22)
  }
}

export function useLiveSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      } catch { return null }
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {})
    }
    return ctxRef.current
  }, [])

  const play = useCallback((event: LiveSoundEvent) => {
    if (!enabledRef.current) return
    const ctx = getCtx()
    if (!ctx) return
    switch (event) {
      case 'goal': synthesizeGoal(ctx); break
      case 'follow_goal': synthesizeFollowGoal(ctx); break
      case 'card': synthesizeCard(ctx); break
      case 'whistle': synthesizeWhistle(ctx); break
      case 'kickoff': synthesizeKickoff(ctx); break
    }
  }, [getCtx])

  const setEnabled = useCallback((val: boolean) => {
    enabledRef.current = val
  }, [])

  const isEnabled = useCallback(() => enabledRef.current, [])

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {})
      ctxRef.current = null
    }
  }, [])

  return { play, setEnabled, isEnabled }
}

export interface MatchEventSnapshot {
  id: string
  type: string
  matchId: string
  teamId?: string
}

export function useLiveMatchSounds(
  matches: Array<{
    id: string
    status: string
    homeScore?: number | null
    awayScore?: number | null
    homeTeam: { id?: string; name: string }
    awayTeam: { id?: string; name: string }
  }>,
  followedTeamIds: string[],
) {
  const { play } = useLiveSound()
  const prevRef = useRef<Map<string, { homeScore: number; awayScore: number; status: string }>>(new Map())
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      // Seed initial state without playing sounds
      matches.forEach(m => {
        prevRef.current.set(m.id, {
          homeScore: m.homeScore ?? 0,
          awayScore: m.awayScore ?? 0,
          status: m.status,
        })
      })
      initialized.current = true
      return
    }

    matches.forEach(m => {
      const prev = prevRef.current.get(m.id)
      const curHome = m.homeScore ?? 0
      const curAway = m.awayScore ?? 0
      const prevHome = prev?.homeScore ?? 0
      const prevAway = prev?.awayScore ?? 0
      const prevStatus = prev?.status ?? ''
      const isFollowedMatch = followedTeamIds.includes(m.homeTeam.id || '') || followedTeamIds.includes(m.awayTeam.id || '')

      // Detect kickoff
      if (m.status === 'live' && prevStatus === 'scheduled') {
        play('kickoff')
      }

      // Detect goals
      if (curHome > prevHome || curAway > prevAway) {
        play(isFollowedMatch ? 'follow_goal' : 'goal')
      }

      prevRef.current.set(m.id, { homeScore: curHome, awayScore: curAway, status: m.status })
    })
  }, [matches, followedTeamIds, play])
}
