'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useAuth } from '@/contexts/auth-context';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { CompetitionPaymentModal } from './competition-payment-modal';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Props {
  slug: string;
  isFull?: boolean;
  isCompleted?: boolean;
  entryFee?: number;
  currency?: string;
  competitionName?: string;
}

export function JoinCompetitionButton({ slug, isFull, isCompleted, entryFee = 0, currency = 'KES', competitionName }: Props) {
  const { open: openAuthModal } = useAuthModal();
  const { user, isLoading: authLoading } = useAuth();
  const { data: joinRes, mutate } = useSWR<{ joined: boolean }>(
    `/api/competitions/${slug}/join`,
    fetcher,
    { revalidateOnFocus: true },
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justJoined, setJustJoined] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (joinRes?.joined) setJustJoined(true);
  }, [joinRes?.joined]);

  // When auth state changes (e.g. user just logged in via the modal), re-check join status.
  useEffect(() => {
    if (user) mutate();
  }, [user?.id, mutate]);

  const performJoin = async (paymentRef?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/competitions/${slug}/join`, {
        method: 'POST',
        headers: paymentRef ? { 'Content-Type': 'application/json' } : undefined,
        body: paymentRef ? JSON.stringify({ paymentRef }) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        setError(data.error || 'Could not join competition.');
        return false;
      }
      setJustJoined(true);
      mutate();
      return true;
    } catch {
      setError('Network error. Try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    if (authLoading) return;
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (entryFee > 0) {
      setShowPayment(true);
      return;
    }
    await performJoin();
  };

  if (isCompleted) {
    return (
      <Button size="sm" className="h-7 text-xs" disabled>
        Competition ended
      </Button>
    );
  }
  if (justJoined) {
    return (
      <Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-500/90 text-white" disabled>
        <Check className="mr-1 h-3 w-3" /> Joined
      </Button>
    );
  }
  if (isFull) {
    return (
      <Button size="sm" className="h-7 text-xs" disabled>
        Competition full
      </Button>
    );
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" className="h-7 text-xs" onClick={handleJoin} disabled={submitting || authLoading}>
          {submitting ? (
            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Joining…</>
          ) : entryFee > 0 ? (
            <>Pay {currency} {entryFee} & Join<ChevronRight className="ml-1 h-3 w-3" /></>
          ) : (
            <>Join Competition<ChevronRight className="ml-1 h-3 w-3" /></>
          )}
        </Button>
        {error && <p className="text-[10px] text-rose-500">{error}</p>}
      </div>
      {showPayment && (
        <CompetitionPaymentModal
          open={showPayment}
          onClose={() => setShowPayment(false)}
          competitionName={competitionName || slug}
          amount={entryFee}
          currency={currency}
          onSuccess={async (ref) => {
            const ok = await performJoin(ref);
            if (ok) setShowPayment(false);
          }}
        />
      )}
    </>
  );
}
