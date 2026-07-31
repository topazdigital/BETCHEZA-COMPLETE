"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Trophy, Users, CheckCircle2 } from "lucide-react";
import { TeamLogo } from "@/components/ui/team-logo";
import { cn } from "@/lib/utils";

type Pick = "home" | "draw" | "away";

interface Totals {
  home: number;
  draw: number;
  away: number;
  total: number;
}

interface VoteResponse {
  matchId: string;
  totals: Totals;
  myVote: Pick | null;
}

interface WinnerVoteProps {
  matchId: string;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  /** Hide the draw option for sports where ties don't apply (e.g. basketball, tennis). */
  allowDraw?: boolean;
  /**
   * Status of the match — when it's anything other than `scheduled` we lock
   * the poll and show the final crowd sentiment without accepting new votes.
   */
  matchStatus?: string;
  /** Kickoff time; if it's already in the past we also lock the poll. */
  kickoffTime?: string | Date;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function WinnerVote({
  matchId,
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  allowDraw = true,
  matchStatus,
  kickoffTime,
}: WinnerVoteProps) {
  // Lock voting once the match has kicked off. We mirror the same rule the
  // server uses (status check + kickoff timestamp) so users get instant UI
  // feedback instead of waiting for a 409 round-trip.
  const lockedStatuses = new Set(['live', 'halftime', 'extra_time', 'penalties', 'finished']);
  const kickoffMs = kickoffTime
    ? (kickoffTime instanceof Date ? kickoffTime.getTime() : new Date(kickoffTime).getTime())
    : NaN;
  const locked = (matchStatus ? lockedStatuses.has(matchStatus) : false)
    || (Number.isFinite(kickoffMs) && kickoffMs <= Date.now());
  const url = `/api/matches/${encodeURIComponent(matchId)}/vote`;
  const { data, mutate, isLoading } = useSWR<VoteResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });
  const [submitting, setSubmitting] = useState<Pick | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Local optimistic copy so the bars react immediately on click.
  const [optimistic, setOptimistic] = useState<VoteResponse | null>(null);
  useEffect(() => {
    if (data) setOptimistic(null);
  }, [data]);

  const view = optimistic ?? data;
  const totals = view?.totals ?? { home: 0, draw: 0, away: 0, total: 0 };
  const myVote = view?.myVote ?? null;
  const hasVoted = !!myVote;

  const homePct = pct(totals.home, totals.total);
  const drawPct = pct(totals.draw, totals.total);
  const awayPct = pct(totals.away, totals.total);

  async function cast(pick: Pick) {
    if (hasVoted || submitting || locked) return;
    setSubmitting(pick);
    // Optimistic update
    const next: VoteResponse = {
      matchId,
      totals: {
        ...totals,
        [pick]: totals[pick] + 1,
        total: totals.total + 1,
      },
      myVote: pick,
    };
    setOptimistic(next);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pick }),
      });
      const json = (await res.json()) as VoteResponse & { ok?: boolean; reason?: string };
      if (!res.ok && json.reason === "already_voted") {
        setFlash("You've already voted on this match.");
      } else if (!res.ok && json.reason === "voting_closed") {
        setFlash("Voting has closed — the match has already kicked off.");
      }
      // Replace optimistic with server truth.
      await mutate(json, { revalidate: false });
      setOptimistic(null);
    } catch {
      setFlash("Couldn't record your vote. Please try again.");
      setOptimistic(null);
      await mutate();
    } finally {
      setSubmitting(null);
      if (flash) setTimeout(() => setFlash(null), 2500);
    }
  }

  const buttons: Array<{ pick: Pick; label: string; logo?: string; pctVal: number; count: number }> = [
    { pick: "home", label: homeName, logo: homeLogo, pctVal: homePct, count: totals.home },
    ...(allowDraw
      ? [{ pick: "draw" as const, label: "Draw", logo: undefined, pctVal: drawPct, count: totals.draw }]
      : []),
    { pick: "away", label: awayName, logo: awayLogo, pctVal: awayPct, count: totals.away },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Who will win?
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{totals.total.toLocaleString()} {totals.total === 1 ? "vote" : "votes"}</span>
        </div>
      </div>

      {/* Always 3-column on mobile for compactness, consistent layout */}
      <div className={cn("grid gap-1.5", allowDraw ? "grid-cols-3" : "grid-cols-2")}>
        {buttons.map(({ pick, label, logo, pctVal, count }) => {
          const isMine = myVote === pick;
          const disabled = hasVoted || submitting !== null || locked;
          const revealResults = hasVoted || locked;
          return (
            <button
              key={pick}
              type="button"
              onClick={() => cast(pick)}
              disabled={disabled}
              className={cn(
                "group relative overflow-hidden rounded-lg border p-2 text-center transition-all",
                "border-border bg-background",
                !disabled && "hover:border-primary hover:bg-primary/5",
                isMine && "border-primary bg-primary/10",
                disabled && !isMine && "opacity-75",
              )}
            >
              {revealResults && (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 -z-0",
                    isMine ? "bg-primary/20" : "bg-muted",
                  )}
                  style={{ width: `${pctVal}%` }}
                  aria-hidden
                />
              )}

              <div className="relative z-10 flex flex-col items-center gap-1">
                {pick === "draw" ? (
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 font-black text-base",
                    isMine
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground group-hover:border-primary group-hover:text-primary",
                  )}>
                    X
                  </div>
                ) : (
                  <TeamLogo teamName={label} logoUrl={logo} size="sm" />
                )}
                <span className="w-full truncate text-[10px] font-medium text-foreground leading-tight">{label}</span>
                {revealResults ? (
                  <span className="text-xs font-bold tabular-nums text-foreground">{pctVal}%</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Vote
                  </span>
                )}
                {isMine && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {isLoading
          ? "Loading votes…"
          : locked
            ? "Voting closed — match started."
            : hasVoted
              ? "Thanks! Results update live."
              : "One vote per device · no login needed."}
      </p>
      {flash && (
        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{flash}</p>
      )}
    </div>
  );
}
