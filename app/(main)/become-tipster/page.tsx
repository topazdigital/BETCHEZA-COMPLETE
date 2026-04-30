'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, CheckCircle2, Clock, Loader2, ShieldCheck, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface ApplicationRow {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  pitch: string;
  specialties: string;
  createdAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
  verifiedGranted?: boolean;
  requestVerified: boolean;
}

interface MeResp { applications: ApplicationRow[]; currentRole: string }

export default function BecomeTipsterPage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [pitch, setPitch] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [experience, setExperience] = useState('');
  const [socialProof, setSocialProof] = useState('');
  const [requestVerified, setRequestVerified] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/tipster-applications', { cache: 'no-store' });
      if (r.status === 401) {
        setSignedIn(false);
        setMe(null);
        return;
      }
      setSignedIn(true);
      const data = (await r.json()) as MeResp;
      setMe(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/tipster-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch, specialties, experience, socialProof, requestVerified }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error || 'Application failed.');
      } else {
        setSuccess('Application submitted. We usually review within 24–48 hours.');
        setPitch('');
        setSpecialties('');
        setExperience('');
        setSocialProof('');
        setRequestVerified(false);
        await load();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingApp = me?.applications.find(a => a.status === 'pending');
  const isAlreadyTipster =
    me?.currentRole === 'tipster' || me?.currentRole === 'admin' ||
    me?.currentRole === 'moderator' || me?.currentRole === 'editor';

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-primary/15 p-3">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Become a tipster</h1>
          <p className="text-sm text-muted-foreground">
            Share your picks with the Betcheza community. Build a record, earn followers, and unlock pro features.
          </p>
        </div>
      </div>

      {/* Perks */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-sm">
            <Trophy className="mb-2 h-5 w-5 text-primary" />
            <div className="font-semibold">Public profile</div>
            <p className="text-muted-foreground">Get your own tipster page with stats, ROI charts and follower count.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-sm">
            <BadgeCheck className="mb-2 h-5 w-5 text-primary" />
            <div className="font-semibold">Verified badge</div>
            <p className="text-muted-foreground">Apply for the verified checkmark — visible across the leaderboard, feed and cards.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-sm">
            <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
            <div className="font-semibold">Earn from pro tips</div>
            <p className="text-muted-foreground">Approved tipsters can charge a monthly subscription for premium picks.</p>
          </CardContent>
        </Card>
      </div>

      {/* Status messages */}
      {!signedIn && !loading && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            You need to sign in before applying.{' '}
            <Link className="font-semibold text-primary hover:underline" href="/login">Sign in</Link>
            {' '}or{' '}
            <Link className="font-semibold text-primary hover:underline" href="/register">create a free account</Link>.
          </CardContent>
        </Card>
      )}

      {signedIn && isAlreadyTipster && (
        <Card className="mb-6 border-success/40 bg-success/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              You&apos;re already a tipster. Head to your{' '}
              <Link className="font-semibold text-primary hover:underline" href="/dashboard">dashboard</Link>
              {' '}to post your next pick.
            </div>
          </CardContent>
        </Card>
      )}

      {signedIn && pendingApp && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Clock className="mt-0.5 h-5 w-5 text-warning" />
            <div>
              Your application is <strong>pending review</strong>. Submitted{' '}
              {new Date(pendingApp.createdAt).toLocaleString()}. We&apos;ll notify you once an admin decides.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past applications */}
      {signedIn && me && me.applications.some(a => a.status !== 'pending') && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your previous applications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {me.applications.filter(a => a.status !== 'pending').map(app => (
              <div key={app.id} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  {app.status === 'approved' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-semibold capitalize">{app.status}</span>
                  {app.verifiedGranted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <BadgeCheck className="h-3 w-3" /> VERIFIED GRANTED
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : ''}
                  </span>
                </div>
                {app.reviewerNote && (
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-semibold text-foreground">Note:</span> {app.reviewerNote}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* The form */}
      {signedIn && !isAlreadyTipster && !pendingApp && (
        <Card>
          <CardHeader>
            <CardTitle>Tipster application</CardTitle>
            <CardDescription>
              All fields marked * are required. Be specific — vague pitches get rejected. Approved applicants can start posting tips immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="pitch">Why should we approve you? *</Label>
                <Textarea
                  id="pitch"
                  required
                  minLength={40}
                  rows={5}
                  placeholder="e.g. I've been tracking EPL & La Liga for 3 years on a private telegram with 60% win-rate over 400+ tips. My edge is set-piece markets and tactical mismatches…"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">{pitch.length}/40 minimum</p>
              </div>

              <div>
                <Label htmlFor="specialties">Sports / leagues you focus on *</Label>
                <Input
                  id="specialties"
                  required
                  placeholder="e.g. EPL, La Liga, BTTS & Over 2.5 markets"
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="experience">Experience / track record (optional)</Label>
                <Textarea
                  id="experience"
                  rows={3}
                  placeholder="Years tipping, ROI, where you've posted before, screenshots — paste links if you have them."
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="socialProof">Social handles or proof links (optional)</Label>
                <Input
                  id="socialProof"
                  placeholder="@yourhandle on Twitter / Telegram channel link"
                  value={socialProof}
                  onChange={(e) => setSocialProof(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox
                  id="verified"
                  checked={requestVerified}
                  onCheckedChange={(v) => setRequestVerified(!!v)}
                />
                <div className="text-sm">
                  <div className="font-semibold">Apply for the verified badge</div>
                  <p className="text-xs text-muted-foreground">
                    Granted to tipsters with proven track records. Admins may still approve you as a tipster without the badge — you can re-apply for verification later.
                  </p>
                </div>
              </label>

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              {success && (
                <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{success}</div>
              )}

              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit application
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
    </div>
  );
}
