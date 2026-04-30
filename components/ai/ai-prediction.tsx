'use client';

import { Brain, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { AIPrediction as AIPredictionType, MatchWithDetails } from '@/lib/types';

interface AIPredictionProps {
  prediction?: AIPredictionType;
  match: MatchWithDetails;
}

export function AIPrediction({ prediction, match }: AIPredictionProps) {
  if (!prediction) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">No AI Prediction</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          AI prediction for this match is not available yet. Check back closer to kickoff.
        </p>
      </div>
    );
  }

  const confidenceColor =
    prediction.confidence >= 70
      ? 'text-success'
      : prediction.confidence >= 50
      ? 'text-warning'
      : 'text-destructive';

  const confidenceBg =
    prediction.confidence >= 70
      ? 'bg-success'
      : prediction.confidence >= 50
      ? 'bg-warning'
      : 'bg-destructive';

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Betcheza AI Analysis</h3>
          <p className="text-xs text-muted-foreground">Powered by Betcheza AI</p>
        </div>
      </div>

      {/* Prediction */}
      <div className="p-4">
        {/* Main Prediction */}
        <div className="mb-6 rounded-lg bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Predicted Outcome</p>
              <p className="mt-1 text-xl font-bold text-foreground">{prediction.prediction}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Confidence</p>
              <p className={cn('mt-1 text-2xl font-bold', confidenceColor)}>
                {prediction.confidence}%
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={prediction.confidence} className={cn('h-2', confidenceBg)} />
          </div>
        </div>

        {/* Reasoning */}
        <div className="mb-6">
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Analysis
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{prediction.reasoning}</p>
        </div>

        {/* Key Factors */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <h5 className="mb-2 text-sm font-medium text-foreground">Home Team Form</h5>
            <div className="flex gap-1">
              {['W', 'W', 'D', 'W', 'L'].map((result, i) => (
                <span
                  key={i}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded text-xs font-bold',
                    result === 'W' && 'bg-success/10 text-success',
                    result === 'D' && 'bg-warning/10 text-warning',
                    result === 'L' && 'bg-destructive/10 text-destructive'
                  )}
                >
                  {result}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <h5 className="mb-2 text-sm font-medium text-foreground">Away Team Form</h5>
            <div className="flex gap-1">
              {['L', 'W', 'W', 'D', 'W'].map((result, i) => (
                <span
                  key={i}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded text-xs font-bold',
                    result === 'W' && 'bg-success/10 text-success',
                    result === 'D' && 'bg-warning/10 text-warning',
                    result === 'L' && 'bg-destructive/10 text-destructive'
                  )}
                >
                  {result}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            AI predictions are for informational purposes only and should not be considered as
            financial advice. Always gamble responsibly.
          </p>
        </div>
      </div>
    </div>
  );
}
