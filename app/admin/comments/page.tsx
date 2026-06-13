'use client';
import dynamicImport from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const AdminCommentsClient = dynamicImport(() => import('./comments-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-32 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function AdminCommentsPage() {
  return <AdminCommentsClient />;
}
