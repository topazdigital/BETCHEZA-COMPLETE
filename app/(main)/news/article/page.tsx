'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Loader2, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function ArticleReader() {
  const params = useSearchParams();
  const router = useRouter();

  const headline = params.get('headline') || '';
  const description = params.get('description') || '';
  const image = params.get('image') || '';
  const published = params.get('published') || '';
  const sourceUrl = params.get('source_url') || '';
  const source = params.get('source') || 'ESPN';

  const [fullBody, setFullBody] = useState<string[] | null>(null);
  const [fullBodyLoading, setFullBodyLoading] = useState(false);
  const [fullBodyError, setFullBodyError] = useState<string | null>(null);

  // Fetch the full article body inline so users never need to bounce off-site.
  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    setFullBodyLoading(true);
    setFullBodyError(null);
    fetch(`/api/news/article?url=${encodeURIComponent(sourceUrl)}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || `Fetch ${r.status}`);
        return j as { paragraphs?: string[] };
      })
      .then((j) => {
        if (cancelled) return;
        if (Array.isArray(j.paragraphs) && j.paragraphs.length > 0) {
          setFullBody(j.paragraphs);
        }
      })
      .catch((e) => {
        if (!cancelled) setFullBodyError(e instanceof Error ? e.message : 'Could not load full article');
      })
      .finally(() => {
        if (!cancelled) setFullBodyLoading(false);
      });
    return () => { cancelled = true; };
  }, [sourceUrl]);

  if (!headline) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <Newspaper className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-4 text-2xl font-bold">Article not found</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t load this article. It may have been removed or the link is broken.
        </p>
        <Button className="mt-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back
        </Button>
      </div>
    );
  }

  // Format the published date in a human-friendly way.
  const publishedLabel = published
    ? new Date(published).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  // Pull a few sentences out of the description to render as the article body.
  // ESPN's match-news API exposes a short description rather than the full
  // article body, so we render that here and link to the original story for
  // readers who want the full piece.
  const bodyParagraphs = description
    .split(/(?<=[.!?])\s+/)
    .reduce<string[]>((acc, sentence) => {
      const last = acc[acc.length - 1];
      if (!last || last.length > 220) acc.push(sentence);
      else acc[acc.length - 1] = `${last} ${sentence}`;
      return acc;
    }, []);

  return (
    <article className="mx-auto max-w-2xl px-3 py-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-3 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </button>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-tight">
        <Badge variant="secondary" className="gap-1 h-5 px-1.5 text-[9px] font-bold">
          <Newspaper className="h-2.5 w-2.5" />
          {source}
        </Badge>
        {publishedLabel && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {publishedLabel}
          </span>
        )}
      </div>

      <h1 className="mb-4 text-balance text-xl font-bold tracking-tight sm:text-2xl leading-tight">
        {headline}
      </h1>

      {image && (
        <div className="mb-4 overflow-hidden rounded-xl">
          <Image
            src={image}
            alt={headline}
            width={800}
            height={450}
            unoptimized
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      <div className="prose prose-sm max-w-none text-foreground leading-snug">
        {fullBodyLoading && (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading the full story…
          </div>
        )}
        {!fullBodyLoading && fullBody && fullBody.length > 0 ? (
          fullBody.map((p, i) => (
            <p key={`f${i}`} className="mb-3 text-[13px] text-foreground/90">
              {p}
            </p>
          ))
        ) : !fullBodyLoading && bodyParagraphs.length > 0 ? (
          bodyParagraphs.map((p, i) => (
            <p key={i} className="mb-3 text-[13px] text-foreground/90">
              {p}
            </p>
          ))
        ) : !fullBodyLoading ? (
          <p className="text-xs text-muted-foreground italic">No preview available for this story.</p>
        ) : null}
        {fullBodyError && !fullBody && bodyParagraphs.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground italic">
            (Showing summary — full article body unavailable.)
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-4 text-center">
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-muted-foreground">
          <Link href="/matches">Back to matches</Link>
        </Button>
      </div>
    </article>
  );
}

export default function NewsArticlePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
          Loading article…
        </div>
      }
    >
      <ArticleReader />
    </Suspense>
  );
}
