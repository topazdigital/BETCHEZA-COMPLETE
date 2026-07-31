import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found | Betcheza',
  description: 'The page you are looking for does not exist. Browse matches, tipsters, and free betting tips on Betcheza.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto space-y-6">
        <div className="text-7xl font-black text-primary/20 select-none">404</div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            That page does not exist or may have moved. Head back to Betcheza for free betting tips, live scores, and AI predictions.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to homepage
          </Link>
          <Link
            href="/matches"
            className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Browse matches
          </Link>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-muted-foreground">
          <Link href="/tipsters" className="hover:text-foreground">Tipsters</Link>
          <Link href="/leaderboard" className="hover:text-foreground">Leaderboard</Link>
          <Link href="/jackpots" className="hover:text-foreground">Jackpots</Link>
          <Link href="/competitions" className="hover:text-foreground">Competitions</Link>
          <Link href="/help" className="hover:text-foreground">Help</Link>
        </div>
      </div>
    </div>
  );
}
