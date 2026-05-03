"use client"

import { use, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import {
  ArrowLeft, Trophy, Calendar, TrendingUp,
  ChevronRight, Clock, Star, Target, Loader2,
  AlertCircle, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchCardNew } from "@/components/matches/match-card-new"
import { KnockoutBracket } from "@/components/leagues/knockout-bracket"
import { Spinner } from "@/components/ui/spinner"
import { TeamLogo } from "@/components/ui/team-logo"
import { FlagIcon } from "@/components/ui/flag-icon"
import { cn } from "@/lib/utils"
import { ALL_LEAGUES, getSportIcon } from "@/lib/sports-data"
import { playerHref } from "@/lib/utils/slug"
import { resolveLeagueSlug } from "@/lib/league-aliases"
import { useMatches } from "@/lib/hooks/use-matches"
import { isLiveMatchStatus } from "@/lib/utils/live-status"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PageProps {
  params: Promise<{ slug: string }>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface StandingRow {
  position: number