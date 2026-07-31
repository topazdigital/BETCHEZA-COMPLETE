'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { OutrightTipModal, type OutrightTipData } from '@/components/leagues/outright-tip-modal';
import { cn } from '@/lib/utils';

interface Props {
  data: OutrightTipData;
  className?: string;
  label?: string;
}

export function OutrightTipButton({ data, className, label = 'Tip' }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const isTipster = user?.role === 'tipster' || user?.role === 'admin';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-semibold px-1.5 py-0.5 transition-colors shrink-0',
          className
        )}
        title={`Post a tip: ${data.prediction} @ ${data.odds.toFixed(2)}`}
      >
        {label}
      </button>
      <OutrightTipModal
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        isAuthenticated={!!user}
        isTipster={isTipster}
        onOpenAuth={(mode) => openAuthModal(mode)}
      />
    </>
  );
}
