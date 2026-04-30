'use client';

import { useEffect, useState } from 'react';
import { Mail, Save, RotateCcw, Eye, Code, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface Template {
  key: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
  updatedAt: string;
}

export default function EmailTemplatesAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Template>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates');
      const data = await res.json();
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
        if (!activeKey && data.templates[0]) {
          setActiveKey(data.templates[0].key);
          setDraft(data.templates[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const active = templates.find((t) => t.key === activeKey) || null;

  const switchTo = (key: string) => {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    setActiveKey(key);
    setDraft(t);
    setStatus(null);
  };

  const save = async () => {
    if (!activeKey) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: activeKey,
          subject: draft.subject,
          html: draft.html,
          text: draft.text,
          name: draft.name,
          description: draft.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: 'err', msg: data.error || 'Save failed' });
      } else {
        setStatus({ kind: 'ok', msg: 'Template saved.' });
        await load();
      }
    } catch {
      setStatus({ kind: 'err', msg: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!activeKey) return;
    if (!confirm('Reset this template to its default? Your changes will be lost.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates?key=${activeKey}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.template) {
        setStatus({ kind: 'ok', msg: 'Reset to default.' });
        await load();
        setDraft(data.template);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = (tpl: string) => {
    if (!active) return tpl;
    const sample: Record<string, string> = {
      name: 'Alex',
      email: 'alex@example.com',
      siteUrl: 'https://betcheza.com',
      subject: 'Sample subject',
      heading: 'A sample heading',
      body: 'A sample body paragraph.',
      resetUrl: 'https://betcheza.com/reset/abc',
      competitionName: 'Weekend Football Mega',
      slug: 'weekend-football-mega',
      currency: 'KES',
      amount: '500',
      reference: 'BCZ-12345',
    };
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sample[k] ?? `{{${k}}}`);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Email Templates</h1>
          <p className="text-xs text-muted-foreground">Edit transactional &amp; broadcast emails. Use <code className="px-1 py-0.5 rounded bg-muted text-[11px]">{'{{var}}'}</code> for dynamic data.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Template list */}
          <Card className="col-span-12 md:col-span-3">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Templates</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2 space-y-1">
              {templates.map((t) => (
                <button
                  key={t.key}
                  onClick={() => switchTo(t.key)}
                  className={cn(
                    'w-full text-left rounded-md px-2 py-2 text-xs transition-colors',
                    activeKey === t.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{t.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Editor */}
          {active && (
            <Card className="col-span-12 md:col-span-9">
              <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">{active.name}</CardTitle>
                  <CardDescription className="text-[11px]">{active.description}</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={reset} disabled={saving}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset
                  </Button>
                  <Button size="sm" className="h-7 text-[11px]" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                    Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {active.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <span className="text-muted-foreground uppercase tracking-wide">Variables:</span>
                    {active.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide">Subject</Label>
                  <Input
                    className="h-9"
                    value={draft.subject || ''}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>

                <Tabs value={view} onValueChange={(v) => setView(v as 'edit' | 'preview')}>
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger value="edit" className="h-7 text-[11px] gap-1"><Code className="h-3 w-3" /> Edit</TabsTrigger>
                    <TabsTrigger value="preview" className="h-7 text-[11px] gap-1"><Eye className="h-3 w-3" /> Preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="edit" className="space-y-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide">HTML body</Label>
                      <Textarea
                        rows={14}
                        className="font-mono text-[11px]"
                        value={draft.html || ''}
                        onChange={(e) => setDraft({ ...draft, html: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide">Plain-text fallback</Label>
                      <Textarea
                        rows={6}
                        className="font-mono text-[11px]"
                        value={draft.text || ''}
                        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="mt-3">
                    <div className="space-y-2">
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Subject: </span>
                        <span className="font-semibold">{renderPreview(draft.subject || '')}</span>
                      </div>
                      <div className="rounded-md border bg-white p-3 text-black overflow-auto max-h-[480px]">
                        <iframe
                          title="email-preview"
                          srcDoc={renderPreview(draft.html || '')}
                          className="w-full h-[460px] border-0"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {status && (
                  <div className={cn(
                    'flex items-center gap-2 rounded-md border p-2 text-xs',
                    status.kind === 'ok'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  )}>
                    {status.kind === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {status.msg}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Last updated: {new Date(active.updatedAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
