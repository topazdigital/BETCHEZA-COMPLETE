import { Wrench } from 'lucide-react';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const settings = await getSiteSettings();
  const message =
    settings.maintenance_message ||
    "We're making the site faster and adding new features. We'll be right back.";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted px-3">
      <div className="max-w-xs rounded-xl border border-border bg-card p-6 text-center shadow-md">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <Wrench className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="text-lg font-bold">Down for maintenance</h1>
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        <p className="mt-4 text-[10px] text-muted-foreground/70">
          {settings.site_name || 'Betcheza'} — back online shortly.
        </p>
      </div>
    </div>
  );
}
