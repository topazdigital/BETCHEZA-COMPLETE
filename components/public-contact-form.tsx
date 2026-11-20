'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CaptchaChallenge, type CaptchaChallengeHandle } from '@/components/auth/captcha-challenge';

export function PublicContactForm() {
  const captchaRef = useRef<CaptchaChallengeHandle>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const captcha = captchaRef.current?.getResult();
    if (!captcha) {
      setError('Please complete the security check.');
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          subject: data.get('subject'),
          message: data.get('message'),
          companyFax: data.get('companyFax'),
          captchaToken: captcha.token,
          captchaId: captcha.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        setError(result.error || 'Could not send your message. Please try again.');
        return;
      }
      setSent(true);
      form.reset();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
      void captchaRef.current?.refresh();
    }
  }

  return (
    <section id="contact-form" className="mx-auto max-w-2xl px-3 pb-8">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">Send us a message</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this protected form and our support team will reply by email.
        </p>

        {sent ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Your message has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="contact-name">Name</Label>
                <Input id="contact-name" name="name" autoComplete="name" maxLength={120} required disabled={busy} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-subject">Subject</Label>
              <Input id="contact-subject" name="subject" maxLength={140} required disabled={busy} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea id="contact-message" name="message" maxLength={3000} rows={5} required disabled={busy} />
            </div>

            <div
              className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden opacity-0"
              aria-hidden="true"
            >
              <label htmlFor="contact-company-fax">Leave this field empty</label>
              <input id="contact-company-fax" name="companyFax" tabIndex={-1} autoComplete="off" />
            </div>

            <CaptchaChallenge ref={captchaRef} visible required />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {busy ? 'Sending…' : 'Send message'}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
