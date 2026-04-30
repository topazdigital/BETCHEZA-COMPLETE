'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StaticPage {
  slug: string;
  title: string;
  body: string;
  meta_description?: string;
}

const SLUG_LABELS: Record<string, string> = {
  help: 'Help Center',
  faq: 'FAQ',
  contact: 'Contact Us',
  'responsible-gambling': 'Responsible Gambling',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
  about: 'About Us',
};

export default function AdminStaticPagesPage() {
  const [pages, setPages] = useState<Record<string, StaticPage>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/static-pages');
        if (res.ok) {
          const data = await res.json();
          const next: Record<string, StaticPage> = {};
          for (const p of data.pages || []) next[p.slug] = p;
          setPages(next);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const update = (slug: string, key: keyof StaticPage, value: string) => {
    setPages((prev) => ({ ...prev, [slug]: { ...prev[slug], [key]: value, slug } as StaticPage }));
  };

  const save = async (slug: string) => {
    const page = pages[slug];
    if (!page) return;
    setSavingSlug(slug);
    setSavedSlug(null);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/static-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setSavedSlug(slug);
      setTimeout(() => setSavedSlug((s) => (s === slug ? null : s)), 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingSlug(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const slugs = Object.keys(SLUG_LABELS);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <FileText className="h-5 w-5" /> Static Pages
        </h1>
        <p className="text-xs text-muted-foreground">
          Edit the content shown on your footer pages. Changes are visible immediately.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      <Tabs defaultValue={slugs[0]} className="space-y-3">
        <TabsList className="h-auto flex flex-wrap gap-1 p-1 bg-muted/50">
          {slugs.map((s) => (
            <TabsTrigger key={s} value={s} className="h-7 text-xs px-2.5">
              {SLUG_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>

        {slugs.map((slug) => {
          const p = pages[slug];
          if (!p) return null;
          return (
            <TabsContent key={slug} value={slug} className="mt-0 focus-visible:outline-none">
              <Card>
                <CardHeader className="py-2 pb-1.5 px-3">
                  <CardTitle className="text-sm font-semibold">{SLUG_LABELS[slug]}</CardTitle>
                  <CardDescription className="text-[10px]">
                    URL: <code className="rounded bg-muted px-1.5">/{slug}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3 pt-0">
                  <div className="space-y-1">
                    <Label htmlFor={`title-${slug}`} className="text-[10px] uppercase font-bold text-muted-foreground px-0.5">Page Title</Label>
                    <Input
                      id={`title-${slug}`}
                      className="h-8 text-xs"
                      value={p.title}
                      onChange={(e) => update(slug, 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`meta-${slug}`} className="text-[10px] uppercase font-bold text-muted-foreground px-0.5">SEO Meta Description (max 160 chars)</Label>
                    <Input
                      id={`meta-${slug}`}
                      className="h-8 text-xs"
                      value={p.meta_description ?? ''}
                      maxLength={160}
                      placeholder="Short summary shown in Google results"
                      onChange={(e) => update(slug, 'meta_description', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`body-${slug}`} className="text-[10px] uppercase font-bold text-muted-foreground px-0.5">Page Content</Label>
                    <Textarea
                      id={`body-${slug}`}
                      value={p.body}
                      onChange={(e) => update(slug, 'body', e.target.value)}
                      className="min-h-[300px] font-mono text-[11px] p-3 leading-relaxed"
                    />
                    <p className="text-[10px] text-muted-foreground px-0.5">
                      Tip: Separate paragraphs with blank lines. Lines starting with{' '}
                      <code className="rounded bg-muted px-1">-</code> become bullets.
                    </p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button onClick={() => save(slug)} disabled={savingSlug === slug} size="sm" className="h-8 text-xs gap-1.5 px-4">
                      {savingSlug === slug ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : savedSlug === slug ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {savingSlug === slug ? 'Saving...' : savedSlug === slug ? 'Saved!' : 'Save Page'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
