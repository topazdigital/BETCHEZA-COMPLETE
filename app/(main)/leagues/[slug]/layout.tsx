import type { Metadata } from 'next';
import { ALL_LEAGUES } from '@/lib/sports-data';

function findLeague(slug: string) {
  return ALL_LEAGUES.find(l => l.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = findLeague(slug);
  const siteName = 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/leagues/${slug}`;

  if (!league) {
    return {
      title: `League Predictions & Tips | ${siteName}`,
      alternates: { canonical },
    };
  }

  const { name, country } = league;
  const locationStr = country ? ` ${country}` : '';
  const title = `${name} Predictions, Tips & Standings | ${siteName}`;
  const description = `Latest ${name}${locationStr} predictions, match tips, standings, fixtures and results. Expert analysis for every ${name} match — free on ${siteName} Kenya.`;

  const keywords = [
    `${name} predictions`,
    `${name} tips`,
    `${name} betting tips`,
    `${name} predictions today`,
    `${name} tips today`,
    `${name} fixtures`,
    `${name} standings`,
    `${name} results`,
    country ? `${name} ${country}` : '',
    country ? `${country} football predictions` : '',
    `${name} match preview`,
    `${name} odds`,
    'football predictions Kenya',
    'league tips Kenya',
    `${siteName} ${name}`,
  ].filter(Boolean);

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = findLeague(slug);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/leagues/${slug}`;

  if (!league) return <>{children}</>;

  const { name, country } = league;

  const sportOrgSchema = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    '@id': canonical,
    name,
    url: canonical,
    ...(country ? { location: { '@type': 'Country', name: country } } : {}),
    sport: 'Football',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Betcheza', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Leagues', item: `${baseUrl}/leagues` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportOrgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
