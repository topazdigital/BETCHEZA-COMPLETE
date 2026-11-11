import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_SPORTS, type SportConfig } from '@/lib/sports-data';
import { getCanonicalSiteUrl } from '@/lib/site-url';

const BASE_URL = getCanonicalSiteUrl();
const PAGE_TITLE = 'Sports Predictions, Tips & Live Scores';
const PAGE_DESCRIPTION =
  'Browse fixtures, predictions, betting tips and live scores across 35 sports. Explore football, basketball, tennis, cricket and more on Betcheza.';

const SPORT_GROUPS: Array<{ category: SportConfig['category']; label: string }> = [
  { category: 'popular', label: 'Popular sports' },
  { category: 'team', label: 'Team sports' },
  { category: 'individual', label: 'Individual sports' },
  { category: 'combat', label: 'Combat sports' },
  { category: 'racing', label: 'Racing sports' },
  { category: 'other', label: 'More sports' },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/sports` },
  openGraph: {
    type: 'website',
    title: `${PAGE_TITLE} | Betcheza`,
    description: PAGE_DESCRIPTION,
    url: `${BASE_URL}/sports`,
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | Betcheza`,
    description: PAGE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const sportListSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  url: `${BASE_URL}/sports`,
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: ALL_SPORTS.map((sport, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: sport.name,
      url: `${BASE_URL}/sports/${sport.slug}`,
    })),
  },
};

export default function SportsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportListSchema) }}
      />
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
          Betcheza sports directory
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Sports Predictions, Tips &amp; Live Scores
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Explore match coverage by sport, including fixtures, predictions, betting tips and live
          scores. Start with football, basketball, tennis or cricket, or choose another sport below.
        </p>
      </header>

      <div className="space-y-8">
        {SPORT_GROUPS.map(group => {
          const sports = ALL_SPORTS.filter(sport => sport.category === group.category);
          if (sports.length === 0) return null;

          return (
            <section key={group.category} aria-labelledby={`sports-${group.category}`}>
              <h2 id={`sports-${group.category}`} className="mb-3 text-xl font-semibold text-foreground">
                {group.label}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sports.map(sport => (
                  <li key={sport.slug}>
                    <Link
                      href={`/sports/${sport.slug}`}
                      className="flex h-full items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span aria-hidden="true" className="text-2xl">{sport.icon}</span>
                      <span>
                        <span className="block font-semibold text-foreground">{sport.name}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          View {sport.name.toLowerCase()} fixtures and predictions
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
