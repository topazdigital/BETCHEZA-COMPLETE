'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AdminError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold">Admin panel error</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message || 'An unexpected error occurred in the admin panel.'}</p>
          {error.digest && <p className="mt-1 font-mono text-[11px] text-muted-foreground/50">Ref: {error.digest}</p>}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}
