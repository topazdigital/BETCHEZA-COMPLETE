import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaticPage } from '@/lib/static-pages-store';
import { getSiteSettings } from '@/lib/site-settings';
import { StaticPageRenderer } from '@/components/static-page-renderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getStaticPage('contact'), getSiteSettings()]);
  const title = page?.title ?? 'Contact Us';
  const description = page?.meta_description ?? 'Get in touch with the ' + settings.site_name + ' team.';
  return { title, description, openGraph: { title, description } };
}

export default async function ContactPage() {
  const page = await getStaticPage('contact');
  if (!page) notFound();
  return <StaticPageRenderer title={page.title} body={page.body} updatedAt={page.updated_at ?? null} />;
}
