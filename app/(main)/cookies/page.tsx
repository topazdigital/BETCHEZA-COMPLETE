import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaticPage } from '@/lib/static-pages-store';
import { StaticPageRenderer } from '@/components/static-page-renderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getStaticPage('cookies');
  const title = page?.title ?? 'Cookie Policy';
  const description = page?.meta_description ?? 'How and why we use cookies and similar technologies.';
  return { title, description, openGraph: { title, description } };
}

export default async function CookiesPage() {
  const page = await getStaticPage('cookies');
  if (!page) notFound();
  return <StaticPageRenderer title={page.title} body={page.body} updatedAt={page.updated_at ?? null} />;
}
