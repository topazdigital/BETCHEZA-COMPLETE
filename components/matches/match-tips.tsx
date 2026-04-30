"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageCircle, 
  TrendingUp,
  Lock,
  Star,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { tipsterHref } from "@/lib/utils/slug"
import type { Tip, Tipster } from "@/lib/types"
import { useAuthModal } from "@/contexts/auth-modal-context"

interface MatchTipsProps {
  matchId: string
  isAuthenticated?: boolean
}

// Mock tips data
const mockTips: (Tip & { tipster: Tipster })[] = [
  {
    id: "1",
    matchId: "1",
    tipsterId: "1",
    prediction: "Home Win",
    odds: 1.85,
    stake: 3,
    confidence: 85,
    analysis: "Arsenal has been dominant at home this season with 8 wins in 9 matches. Chelsea struggles away from home and have conceded in their last 5 away games.",
    isPremium: false,
    status: "pending",
    createdAt: new Date().toISOString(),
    tipster: {
      id: "1",
      userId: "1",
      displayName: "ProTipster",
      bio: "Professional tipster",
      totalTips: 245,
      wonTips: 167,
      lostTips: 78,
      pendingTips: 0,
      roi: 12.5,
      streak: 5,
      rank: 1,
      isPremium: true,
      monthlyPrice: 9.99,
      followers: 1250,
      createdAt: new Date().toISOString(),
    }
  },
  {
    id: "2",
    matchId: "1",
    tipsterId: "2",
    prediction: "Both Teams to Score",
    odds: 1.72,
    stake: 2,
    confidence: 78,
    analysis: "Both teams have scored in 7 of the last 10 H2H matches. Arsenal averages 2.1 goals at home while Chelsea scores 1.4 goals away.",
    isPremium: true,
    status: "pending",
    createdAt: new Date().toISOString(),
    tipster: {
      id: "2",
      userId: "2",
      displayName: "BetKing",
      bio: "Expert analyst",
      totalTips: 189,
      wonTips: 121,
      lostTips: 68,
      pendingTips: 0,
      roi: 8.7,
      streak: 3,
      rank: 5,
      isPremium: true,
      monthlyPrice: 14.99,
      followers: 890,
      createdAt: new Date().toISOString(),
    }
  },
  {
    id: "3",
    matchId: "1",
    tipsterId: "3",
    prediction: "Over 2.5 Goals",
    odds: 1.95,
    stake: 2,
    confidence: 72,
    analysis: "High-scoring fixture historically. 8 of last 10 meetings had over 2.5 goals.",
    isPremium: false,
    status: "pending",
    createdAt: new Date().toISOString(),
    tipster: {
      id: "3",
      userId: "3",
      displayName: "GoalMaster",
      bio: "Goals specialist",
      totalTips: 312,
      wonTips: 187,
      lostTips: 125,
      pendingTips: 0,
      roi: 5.2,
      streak: -2,
      rank: 12,
      isPremium: false,
      monthlyPrice: 0,
      followers: 456,
      createdAt: new Date().toISOString(),
    }
  },
]

function TipCard({ tip, isAuthenticated }: { tip: typeof mockTips[0], isAuthenticated: boolean }) {
  const [likes, setLikes] = useState(Math.floor(Math.random() * 50) + 10)
  const [dislikes, setDislikes] = useState(Math.floor(Math.random() * 10))
  const [userVote, setUserVote] = useState<"like" | "dislike" | null>(null)

  const handleVote = (vote: "like" | "dislike") => {
    if (!isAuthenticated) return
    
    if (userVote === vote) {
      setUserVote(null)
      if (vote === "like") setLikes(l => l - 1)
      else setDislikes(d => d - 1)
    } else {
      if (userVote === "like") setLikes(l => l - 1)
      if (userVote === "dislike") setDislikes(d => d - 1)
      
      setUserVote(vote)
      if (vote === "like") setLikes(l => l + 1)
      else setDislikes(d => d + 1)
    }
  }

  const winRate = Math.round((tip.tipster.wonTips / tip.tipster.totalTips) * 100)
  const showAnalysis = !tip.isPremium || isAuthenticated

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Tipster Info */}
      <div className="flex items-start justify-between">
        <Link href={tipsterHref(tip.tipster.displayName, tip.tipster.id)} className="flex items-center gap-3 hover:opacity-80">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tip.tipster.displayName}`} />
            <AvatarFallback>{tip.tipster.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{tip.tipster.displayName}</span>
              {tip.tipster.isPremium && (
                <Badge className="h-5 bg-warning/20 text-warning hover:bg-warning/30">
                  <Star className="mr-1 h-3 w-3 fill-current" />
                  PRO
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{winRate}% win rate</span>
              <span>|</span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-success" />
                {tip.tipster.roi > 0 ? "+" : ""}{tip.tipster.roi}% ROI
              </span>
            </div>
          </div>
        </Link>
        
        <div className="text-right">
          <Badge variant="outline" className="mb-1">
            Stake: {tip.stake}/5
          </Badge>
          <div className="text-xs text-muted-foreground">
            {tip.confidence}% confident
          </div>
        </div>
      </div>

      {/* Prediction */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 p-3">
        <div>
          <span className="text-sm text-muted-foreground">Prediction</span>
          <p className="text-lg font-bold text-primary">{tip.prediction}</p>
        </div>
        <div className="text-right">
          <span className="text-sm text-muted-foreground">Odds</span>
          <p className="text-lg font-bold text-success">{tip.odds.toFixed(2)}</p>
        </div>
      </div>

      {/* Analysis */}
      <div className="mt-4">
        {showAnalysis ? (
          <p className="text-sm text-muted-foreground">{tip.analysis}</p>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 py-4">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Subscribe to view full analysis
            </span>
            <Button size="sm" variant="outline" className="ml-2">
              Unlock
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1 px-2",
              userVote === "like" && "text-success"
            )}
            onClick={() => handleVote("like")}
          >
            <ThumbsUp className="h-4 w-4" />
            {likes}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1 px-2",
              userVote === "dislike" && "text-destructive"
            )}
            onClick={() => handleVote("dislike")}
          >
            <ThumbsDown className="h-4 w-4" />
            {dislikes}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 px-2">
            <MessageCircle className="h-4 w-4" />
            {Math.floor(Math.random() * 20)}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(tip.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>
    </div>
  )
}

export function MatchTips({ matchId, isAuthenticated = false }: MatchTipsProps) {
  const { open: openAuthModal } = useAuthModal()
  const tips = mockTips.filter(t => t.matchId === matchId || true) // Show all for demo

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold">
          Tips ({tips.length})
        </CardTitle>
        {isAuthenticated && (
          <Button size="sm">
            Add Your Tip
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {tips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="mb-2 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No tips yet for this match</p>
            {isAuthenticated ? (
              <Button className="mt-4">Be the first to add a tip</Button>
            ) : (
              <Button variant="outline" className="mt-4" onClick={() => openAuthModal('login')}>
                Login to add a tip
              </Button>
            )}
          </div>
        ) : (
          <>
            {tips.map((tip) => (
              <TipCard key={tip.id} tip={tip} isAuthenticated={isAuthenticated} />
            ))}
            <Button variant="outline" className="w-full gap-2">
              View All Tips
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
