import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaticPage } from '@/lib/static-pages-store';
import { getSiteSettings } from '@/lib/site-settings';
import { StaticPageRenderer } from '@/components/static-page-renderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getStaticPage('help'), getSiteSettings()]);
  const title = page?.title ?? 'Help Center';
  const description = page?.meta_description ?? 'Get help using ' + settings.site_name;
  return { title, description, openGraph: { title, description } };
}

export default async function HelpPage() {
  const page = await getStaticPage('help');
  if (!page) notFound();
  return <StaticPageRenderer title={page.title} body={page.body} updatedAt={page.updated_at ?? null} />;
}
