const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${BASE_URL}/#website`,
  url: BASE_URL,
  name: 'Betcheza',
  description: "Kenya's #1 sports betting tips and predictions platform. Free AI-powered predictions, live scores and expert tips.",
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/matches?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${BASE_URL}/#organization`,
  name: 'Betcheza',
  url: BASE_URL,
  logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-512.png`, width: 512, height: 512 },
  sameAs: ['https://twitter.com/betcheza', 'https://facebook.com/betcheza'],
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', url: `${BASE_URL}/contact` },
  areaServed: { '@type': 'Country', name: 'Kenya' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Betcheza', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Matches', item: `${BASE_URL}/matches` },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
