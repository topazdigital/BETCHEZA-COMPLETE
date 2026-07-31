import type { Metadata } from 'next';
import CareersPage from './CareersPage';

export const metadata: Metadata = {
  title: 'Careers at Betcheza Kenya — Earn KES 200–500 Per Referral | Agent Jobs 2025',
  description:
    'Join Betcheza as a commission-based sales agent, campus rep, social media creator, WhatsApp manager, or affiliate marketer in Kenya. Earn KES 200–500 per user you refer. Paid weekly via M-Pesa. No experience needed. Apply now and start earning today.',
  keywords: [
    // Brand
    'betcheza careers', 'betcheza jobs', 'betcheza agent', 'betcheza affiliate',
    'betcheza kenya jobs 2025', 'betcheza referral program', 'betcheza commission',
    // Role types
    'sports betting sales agent kenya', 'betting platform agent kenya',
    'commission based sales job kenya', 'commission agent kenya no experience',
    'campus representative kenya', 'campus rep job university kenya',
    'whatsapp group manager job kenya', 'social media creator job kenya',
    'affiliate marketer kenya', 'online marketer kenya', 'digital marketer kenya',
    'tipster job kenya', 'sports tipster partner kenya',
    // Earn + money
    'earn money online kenya', 'earn money referring users kenya',
    'earn commission kenya mpesa', 'make money from phone kenya',
    'side hustle kenya 2025', 'side hustle mpesa payout',
    'work from home kenya', 'flexible jobs kenya', 'remote jobs kenya',
    'part time job kenya nairobi', 'freelance job kenya',
    'earn kes 500 per referral', 'earn kes 200 per signup',
    'money making kenya mpesa', 'easy money kenya online',
    // Sports betting niche
    'football tips agent kenya', 'sports betting tips community kenya',
    'sports prediction site jobs', 'betting tips affiliate program kenya',
    'football prediction agent kenya', 'sports community kenya jobs',
    // Geo
    'nairobi online jobs', 'mombasa online jobs', 'kisumu online jobs',
    'kampala affiliate job', 'east africa commission jobs',
    'kenya betting app agent', 'kenyan sports app careers',
    // Campus + youth
    'student job kenya university', 'university student side hustle',
    'campus hustle kenya', 'student earning kenya', 'kenyatta university jobs',
    'university of nairobi student jobs', 'strathmore student income',
    // Pay + withdrawal
    'mpesa commission job kenya', 'weekly mpesa payout job',
    'instant mpesa payment job kenya', 'pay per referral mpesa',
  ],
  openGraph: {
    title: 'Careers at Betcheza Kenya — Earn KES 200–500 Per Referral',
    description:
      'Flexible, commission-based agent roles. Earn KES 200–500 per verified user you bring in. Campus reps, WhatsApp managers, social media creators, and affiliate marketers welcome. Paid weekly via M-Pesa.',
    url: 'https://betcheza.co.ke/careers',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'website',
    images: [
      {
        url: 'https://betcheza.co.ke/og-careers.jpg',
        width: 1200,
        height: 630,
        alt: 'Betcheza Agent Careers — Earn Commission in Kenya',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Earn with Betcheza — Commission Agent Roles in Kenya',
    description:
      "Refer users to Kenya's #1 sports tips platform. Earn KES 200–500 per verified signup, paid weekly via M-Pesa. Apply free — start earning in 24 hours.",
    images: ['https://betcheza.co.ke/og-careers.jpg'],
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/careers',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

/* ── JSON-LD Job Posting structured data for Google Jobs ─────────────── */
const JOBS_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'JobPosting',
      title: 'Sales Agent — Sports Betting Tips Platform',
      description:
        'Earn KES 200–500 per user you refer to Betcheza, Kenya\'s leading sports betting tips community. Share your personal referral link on WhatsApp, social media, and in person. No experience needed. Commission credited instantly, paid weekly via M-Pesa. Flexible hours, 100% remote.',
      identifier: { '@type': 'PropertyValue', name: 'Betcheza', value: 'sales-agent-001' },
      datePosted: '2025-01-01',
      validThrough: '2026-12-31',
      employmentType: ['CONTRACTOR', 'PART_TIME', 'FULL_TIME'],
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Betcheza',
        sameAs: 'https://betcheza.co.ke',
        logo: 'https://betcheza.co.ke/betcheza-logo.png',
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'KE',
          addressRegion: 'Nairobi County',
        },
      },
      applicantLocationRequirements: { '@type': 'Country', name: 'Kenya' },
      jobLocationType: 'TELECOMMUTE',
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'KES',
        value: {
          '@type': 'QuantitativeValue',
          minValue: 200,
          maxValue: 500,
          unitText: 'per referral',
        },
      },
      skills: 'Social networking, communication, WhatsApp, smartphone literacy',
      qualifications: 'Kenyan resident, 18+, M-Pesa registered number',
      responsibilities:
        'Share Betcheza referral link, recruit users via WhatsApp/social media, demo the platform, track conversions via dashboard',
      url: 'https://betcheza.co.ke/careers#sales-agent',
    },
    {
      '@type': 'JobPosting',
      title: 'Campus Representative — Kenya Universities',
      description:
        'Be the face of Betcheza on your university campus. Earn KES 300 per active user plus monthly bonus when your campus reaches 50+ active users. Host watch-party events, run predictions challenges, and grow the Betcheza community on campus.',
      identifier: { '@type': 'PropertyValue', name: 'Betcheza', value: 'campus-rep-001' },
      datePosted: '2025-01-01',
      validThrough: '2026-12-31',
      employmentType: ['CONTRACTOR', 'PART_TIME'],
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Betcheza',
        sameAs: 'https://betcheza.co.ke',
        logo: 'https://betcheza.co.ke/betcheza-logo.png',
      },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressCountry: 'KE' },
      },
      applicantLocationRequirements: { '@type': 'Country', name: 'Kenya' },
      jobLocationType: 'TELECOMMUTE',
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'KES',
        value: { '@type': 'QuantitativeValue', minValue: 300, maxValue: 500, unitText: 'per referral' },
      },
      qualifications: 'Current university or college student in Kenya',
      url: 'https://betcheza.co.ke/careers#campus-rep',
    },
    {
      '@type': 'JobPosting',
      title: 'WhatsApp Group Manager — Sports Tips',
      description:
        'Own or admin a WhatsApp group? Earn KES 200 per active Betcheza user you convert from your group. Share daily strategy picks, grow your group membership, and earn weekly M-Pesa payouts.',
      identifier: { '@type': 'PropertyValue', name: 'Betcheza', value: 'whatsapp-manager-001' },
      datePosted: '2025-01-01',
      validThrough: '2026-12-31',
      employmentType: ['CONTRACTOR', 'PART_TIME'],
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Betcheza',
        sameAs: 'https://betcheza.co.ke',
        logo: 'https://betcheza.co.ke/betcheza-logo.png',
      },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressCountry: 'KE' },
      },
      applicantLocationRequirements: { '@type': 'Country', name: 'Kenya' },
      jobLocationType: 'TELECOMMUTE',
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'KES',
        value: { '@type': 'QuantitativeValue', minValue: 200, maxValue: 400, unitText: 'per referral' },
      },
      qualifications: 'Active WhatsApp group of 100+ members preferred',
      url: 'https://betcheza.co.ke/careers#whatsapp-manager',
    },
    {
      '@type': 'JobPosting',
      title: 'Social Media Creator — Football & Sports Tips',
      description:
        'Create sports predictions and betting tips content on TikTok, Instagram, X (Twitter), or YouTube. Embed your Betcheza referral link and earn KES 150 per sign-up from your content. Post at least 3x per week.',
      identifier: { '@type': 'PropertyValue', name: 'Betcheza', value: 'social-creator-001' },
      datePosted: '2025-01-01',
      validThrough: '2026-12-31',
      employmentType: ['CONTRACTOR', 'PART_TIME'],
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Betcheza',
        sameAs: 'https://betcheza.co.ke',
        logo: 'https://betcheza.co.ke/betcheza-logo.png',
      },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressCountry: 'KE' },
      },
      applicantLocationRequirements: { '@type': 'Country', name: 'Kenya' },
      jobLocationType: 'TELECOMMUTE',
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'KES',
        value: { '@type': 'QuantitativeValue', minValue: 150, maxValue: 400, unitText: 'per referral' },
      },
      qualifications: 'Active social media account (TikTok, Instagram, X, or YouTube), basic video or graphic skills',
      url: 'https://betcheza.co.ke/careers#social-media-creator',
    },
    {
      '@type': 'JobPosting',
      title: 'Affiliate / Online Marketer',
      description:
        'Drive traffic to Betcheza via blog, SEO, Google Ads, or Facebook Ads. Earn KES 150–400 per signup plus optional rev share. Bloggers, SEO specialists, and paid-ads experts welcome.',
      identifier: { '@type': 'PropertyValue', name: 'Betcheza', value: 'affiliate-001' },
      datePosted: '2025-01-01',
      validThrough: '2026-12-31',
      employmentType: ['CONTRACTOR'],
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Betcheza',
        sameAs: 'https://betcheza.co.ke',
        logo: 'https://betcheza.co.ke/betcheza-logo.png',
      },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressCountry: 'KE' },
      },
      applicantLocationRequirements: { '@type': 'Country', name: 'Kenya' },
      jobLocationType: 'TELECOMMUTE',
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'KES',
        value: { '@type': 'QuantitativeValue', minValue: 150, maxValue: 400, unitText: 'per referral' },
      },
      qualifications: 'Blog, website, or paid advertising experience; SEO or Google Ads knowledge a plus',
      url: 'https://betcheza.co.ke/careers#affiliate-marketer',
    },
    {
      '@type': 'WebPage',
      '@id': 'https://betcheza.co.ke/careers',
      url: 'https://betcheza.co.ke/careers',
      name: 'Careers at Betcheza — Earn Commission as a Sports Betting Tips Agent in Kenya',
      description:
        "Join Betcheza's growing agent network. Commission-based roles for sales agents, campus reps, WhatsApp managers, social media creators, and affiliate marketers across Kenya. Earn KES 200–500 per user. Paid weekly via M-Pesa.",
      inLanguage: 'en-KE',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://betcheza.co.ke' },
          { '@type': 'ListItem', position: 2, name: 'Careers', item: 'https://betcheza.co.ke/careers' },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How much can I earn as a Betcheza agent?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You earn KES 200–500 per user you refer, depending on your tier. Starter agents earn KES 200/user, Active (21–50/month) earn KES 300/user, Pro (51–100/month) earn KES 400/user, and Elite (100+/month) earn KES 500/user. Top agents earn KES 50,000+ per month.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I get paid?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Commission is credited to your Betcheza agent wallet instantly when a referred user qualifies. You can withdraw weekly via M-Pesa with a minimum of KES 500.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need experience to become a Betcheza agent?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No experience is needed. All you need is a smartphone, a Kenyan M-Pesa number, and a network of friends or followers you can share your referral link with. We onboard you within 24 hours of applying.',
          },
        },
        {
          '@type': 'Question',
          name: 'Where do I see my referrals and earnings?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Once you create a Betcheza account, go to your Agent Dashboard at betcheza.co.ke/dashboard/agent to see all users you have referred, their verification status, and your total earnings in real time.',
          },
        },
        {
          '@type': 'Question',
          name: 'What roles are available?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We have six agent roles: Sales Agent (most openings), Campus Representative (students), WhatsApp Group Manager, Social Media Creator, Affiliate/Online Marketer, and Verified Tipster Partner. All are fully remote and commission-based.',
          },
        },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JOBS_JSON_LD) }}
      />
      <CareersPage />
    </>
  );
}
