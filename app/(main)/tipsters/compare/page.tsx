'use client';
import dynamicImport from 'next/dynamic';
import { Spinner } from '@/components/ui/spinner';

export const dynamic = 'force-dynamic';

const ComparePageClient = dynamicImport(() => import('./compare-client'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 p-8 text-center">
      <Spinner className="mx-auto h-8 w-8" />
    </div>
  ),
});

export default function ComparePage() {
  return <ComparePageClient />;
}
