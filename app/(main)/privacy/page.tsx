import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStaticPage } from '@/lib/static-pages-store';
import { StaticPageRenderer } from '@/components/static-page-renderer';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getStaticPage('privacy');
  const title = page?.title ?? 'Privacy Policy';
  const description = page?.meta_description ?? 'How we collect, use, and protect your personal data.';
  return { title, description, openGraph: { title, description } };
}

export default async function PrivacyPage() {
  const page = await getStaticPage('privacy');
  if (!page) notFound();
  return <StaticPageRenderer title={page.title} body={page.body} updatedAt={page.updated_at ?? null} />;
}
