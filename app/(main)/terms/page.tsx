import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaticPage } from '@/lib/static-pages-store';
import { StaticPageRenderer } from '@/components/static-page-renderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getStaticPage('terms');
  const title = page?.title ?? 'Terms of Service';
  const description = page?.meta_description ?? 'The terms and conditions that govern your use of the service.';
  return { title, description, openGraph: { title, description } };
}

export default async function TermsPage() {
  const page = await getStaticPage('terms');
  if (!page) notFound();
  return <StaticPageRenderer title={page.title} body={page.body} updatedAt={page.updated_at ?? null} />;
}
