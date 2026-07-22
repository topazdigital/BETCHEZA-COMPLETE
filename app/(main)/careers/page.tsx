import type { Metadata } from 'next';
import CareersPage from './CareersPage';

export const metadata: Metadata = {
  title: 'Careers at Betcheza — Earn Commission as a Sales Agent',
  description: 'Join Betcheza as a commission-based sales agent, campus rep, social media creator, or affiliate marketer. Earn KES 200–500 per user you refer. Paid weekly via M-Pesa. No experience needed.',
  keywords: [
    'betcheza careers',
    'betcheza jobs kenya',
    'sports betting sales agent kenya',
    'earn money referring users kenya',
    'commission based jobs kenya',
    'betcheza affiliate',
    'kenya betting platform jobs',
    'campus rep kenya',
    'sports tipster job kenya',
    'online earning kenya',
    'mpesa commissions kenya',
  ],
  openGraph: {
    title: 'Careers at Betcheza — Earn Commission as a Sales Agent in Kenya',
    description: 'Flexible, commission-based roles. Earn KES 200–500 per user you refer. Campus reps, WhatsApp managers, social media creators, and affiliate marketers welcome.',
    url: 'https://betcheza.co.ke/careers',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Earn with Betcheza — Commission Sales Roles in Kenya',
    description: 'Refer users to Kenya\'s #1 sports tips platform. Earn KES 200–500 per verified signup, paid weekly via M-Pesa.',
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/careers',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
};

export default function Page() {
  return <CareersPage />;
}
