import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaticPage } from '@/lib/static-pages-store';
import { StaticPageRenderer } from '@/components/static-page-renderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getStaticPage('responsible-gambling');
  const title = page?.title ?? 'Responsible Gambling';
  const description = page?.meta_description ?? 'Bet responsibly. Tools and resources to help you stay in control.';
  return { title, description, openGraph: { title, description } };
}

export default async function ResponsibleGamblingPage() {
  const page = await getStaticPage('responsible-gambling');
  if (!page) notFound();
  return <StaticPageRenderer title={page.title} body={page.body} updatedAt={page.updated_at ?? null} />;
}
