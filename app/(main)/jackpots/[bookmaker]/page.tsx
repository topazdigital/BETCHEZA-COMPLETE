import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import BookmakerJackpotClient from './client';
interface Props { params: Promise<{ bookmaker: string }>; }
const EXTRA_KEYWORDS: Record<string, string[]> = {
  sportpesa: ['SportPesa Mega Jackpot predictions','SportPesa Mega Jackpot tips today','SportPesa Mega Jackpot this week','SportPesa Midweek Jackpot predictions','SportPesa Midweek Jackpot tips','SportPesa jackpot bonus','SportPesa jackpot analysis','SportPesa jackpot games today','how to win SportPesa jackpot Kenya','SportPesa jackpot predictions free'],
  betika: ['Betika Grand Jackpot predictions','Betika Grand Jackpot tips today','Betika Midweek Jackpot tips','Betika Daily Jackpot predictions','Betika jackpot bonus','how to win Betika jackpot','Betika jackpot analysis Kenya'],
  odibets: ['OdiBets Jackpot Bonanza predictions','OdiBets jackpot tips today','OdiBets jackpot analysis Kenya','how to win OdiBets jackpot'],
  betin: ['Betin Grand Jackpot predictions Kenya','Betin Midweek Jackpot tips','Betin jackpot bonus','Betin Kenya jackpot analysis'],
  mozzartbet: ['Mozzartbet Mega Jackpot predictions','Mozzartbet Midweek Jackpot tips Kenya','Mozzartbet jackpot analysis','how to win Mozzartbet jackpot'],
};
export function generateStaticParams() { return SUPPORTED_BOOKMAKERS.map(b => ({ bookmaker: b.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookmaker: slug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === slug);
  if (!bk) return { title: 'Jackpots | Betcheza' };
  const types = bk.jackpotTypes.join(' & ');
  const title = bk.name + ' Jackpot Predictions Today | Free AI Tips — Betcheza Kenya';
  const description = 'Free AI-powered ' + bk.name + ' jackpot predictions for Kenya. Get expert ' + types + ' tips with confidence ratings, updated daily. Win big with Betcheza.co.ke!';
  const extraKw = EXTRA_KEYWORDS[slug] ?? [];
  return { title, description,
    keywords: [bk.name+' jackpot',bk.name+' jackpot predictions',bk.name+' jackpot tips today',bk.name+' jackpot predictions Kenya',...bk.jackpotTypes.map(t=>bk.name+' '+t),...bk.jackpotTypes.map(t=>t+' predictions'),...bk.jackpotTypes.map(t=>t+' tips today'),...extraKw,'Kenya jackpot predictions','jackpot tips Kenya','free jackpot predictions','Betcheza jackpot'],
    openGraph: { title: bk.name+' Jackpot Predictions Today | Betcheza', description, url: 'https://betcheza.co.ke/jackpots/'+bk.slug, type: 'website', siteName: 'Betcheza' },
    twitter: { card: 'summary_large_image', title: bk.name+' Jackpot Predictions | Betcheza Kenya', description },
    alternates: { canonical: 'https://betcheza.co.ke/jackpots/'+bk.slug },
    robots: { index: true, follow: true },
  };
}
export default async function BookmakerJackpotPage({ params }: Props) {
  const { bookmaker: slug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === slug);
  if (!bk) notFound();
  const jsonLd = { '@context':'https://schema.org','@type':'WebPage',name:bk.name+' Jackpot Predictions',description:'Free AI predictions for '+bk.name+' jackpots in Kenya — '+bk.jackpotTypes.join(', ')+'.',url:'https://betcheza.co.ke/jackpots/'+bk.slug,publisher:{'@type':'Organization',name:'Betcheza',url:'https://betcheza.co.ke'},breadcrumb:{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://betcheza.co.ke'},{'@type':'ListItem',position:2,name:'Jackpots',item:'https://betcheza.co.ke/jackpots'},{'@type':'ListItem',position:3,name:bk.name+' Jackpot',item:'https://betcheza.co.ke/jackpots/'+bk.slug}]},mainEntity:{'@type':'FAQPage',mainEntity:bk.jackpotTypes.map(type=>({'@type':'Question',name:'When is the '+bk.name+' '+type+' published?',acceptedAnswer:{'@type':'Answer',text:bk.name+' publishes the '+type+' regularly. Check Betcheza.co.ke for the latest AI predictions as soon as games are released.'}}))}};
  return (<><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><BookmakerJackpotClient bookmaker={bk} /></>);
}
