'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { CaptchaChallenge, type CaptchaChallengeHandle } from '@/components/auth/captcha-challenge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';

const countries = [
  { code: 'KE', name: 'Kenya', dialCode: '+254' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234' },
  { code: 'GH', name: 'Ghana', dialCode: '+233' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255' },
  { code: 'UG', name: 'Uganda', dialCode: '+256' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { code: 'US', name: 'United States', dialCode: '+1' },
];

const TITLES: Record<string, { title: string; desc: string }> = {
  login: {
    title: 'Welcome back',
    desc: 'Sign in to access your tips, picks and dashboard.',
  },
  register: {
    title: 'Create your account',
    desc: 'Join the Betcheza community in under a minute.',
  },
  forgot: {
    title: 'Reset your password',
    desc: 'Enter your email and we’ll send you a reset link.',
  },
  reset: {
    title: 'Choose a new password',
    desc: 'Pick a strong password to finish resetting your account.',
  },
};

export function AuthModal() {
  const { isOpen, view, setView, close } = useAuthModal();
  const meta = TITLES[view] || TITLES.login;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background px-4 pt-4 pb-1.5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
                <span className="font-mono text-xs font-bold text-primary-foreground">B</span>
              </div>
              {meta.title}
            </DialogTitle>
            <DialogDescription className="text-xs">{meta.desc}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-4 pb-4 pt-2">
          {view === 'login' && <LoginPanel />}
          {view === 'register' && <RegisterPanel />}
          {view === 'forgot' && <ForgotPanel />}
          {view === 'reset' && <ResetPanel />}

          {view === 'login' && (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setView('register')}
                className="font-medium text-primary hover:underline"
              >
                Sign up
              </button>
            </p>
          )}
          {view === 'register' && (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
          {(view === 'forgot' || view === 'reset') && (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setView('login')}
                className="font-medium text-primary hover:underline"
              >
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -- Social buttons (Google, Facebook, Apple, GitHub) --------------------
type Provider = 'google' | 'facebook' | 'apple' | 'github';

function startOAuth(provider: Provider) {
  // Always use a full reload — the OAuth callback redirects back to the
  // app after the provider sets a session cookie.
  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  window.location.href = `/api/auth/oauth/${provider}/start?next=${encodeURIComponent(next)}`;
}

function SocialButtons({ mode }: { mode: 'login' | 'register' }) {
  const verb = mode === 'login' ? 'Continue' : 'Sign up';
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => startOAuth('google')}
        className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
      >
        <GoogleIcon />
        {verb} with Google
      </button>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => startOAuth('facebook')}
          className="flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
          title="Facebook"
        >
          <FacebookIcon />
          <span className="hidden sm:inline">Facebook</span>
        </button>
        <button
          type="button"
          onClick={() => startOAuth('apple')}
          className="flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
          title="Apple"
        >
          <AppleIcon />
          <span className="hidden sm:inline">Apple</span>
        </button>
        <button
          type="button"
          onClick={() => startOAuth('github')}
          className="flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
          title="GitHub"
        >
          <GithubIcon />
          <span className="hidden sm:inline">GitHub</span>
        </button>
      </div>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase">
          <span className="bg-background px-2 text-muted-foreground">or use email</span>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.227c1.886-1.736 2.986-4.295 2.986-7.351z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.227-2.51c-.895.6-2.04.954-3.391.954-2.604 0-4.81-1.76-5.6-4.122H3.067v2.591A9.997 9.997 0 0 0 12 22z" fill="#34A853"/>
      <path d="M6.4 13.9a6.013 6.013 0 0 1 0-3.8V7.51H3.067a10.005 10.005 0 0 0 0 8.98L6.4 13.9z" fill="#FBBC05"/>
      <path d="M12 5.977c1.469 0 2.786.504 3.823 1.495l2.864-2.864C16.964 2.99 14.7 2 12 2A9.997 9.997 0 0 0 3.067 7.51L6.4 10.1c.79-2.36 2.996-4.123 5.6-4.123z" fill="#EA4335"/>
    </svg>
  );
}
function FacebookIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
}
function AppleIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>;
}
function GithubIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>;
}

function LoginPanel() {
  const { login, completeTwoFactor, resendTwoFactor } = useAuth();
  const { close, setView } = useAuthModal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [twoFactor, setTwoFactor] = useState<{
    challengeId: string;
    deliveredTo: string;
    channel: string;
    warning?: string;
  } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendNote, setResendNote] = useState('');
  // Remember me — when checked, the auth cookie + JWT are extended to 30
  // days. Otherwise we use the 7-day default.
  const [rememberMe, setRememberMe] = useState(true);
  // Captcha is hidden by default — we surface it once the server flags
  // captchaRequired (typically after 3 failed attempts) so legitimate users
  // never have to solve one on the first try.
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const captchaRef = useRef<CaptchaChallengeHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let captcha: { token: string; id?: string } | undefined;
    if (captchaRequired) {
      const r = captchaRef.current?.getResult();
      if (!r) {
        setError('Please complete the security check.');
        return;
      }
      captcha = r;
    }
    setIsLoading(true);
    const result = await login(email, password, captcha, { rememberMe });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Login failed');
      if (result.captchaRequired) {
        setCaptchaRequired(true);
        // Refresh the challenge so the user gets a fresh one after a failure.
        await captchaRef.current?.refresh();
      }
      return;
    }
    if (result.requiresTwoFactor && result.challengeId) {
      setTwoFactor({
        challengeId: result.challengeId,
        deliveredTo: result.deliveredTo || '',
        channel: result.channel || 'email',
        warning: result.warning,
      });
      return;
    }
    close();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactor) return;
    setError('');
    setIsLoading(true);
    const r = await completeTwoFactor(twoFactor.challengeId, otpCode);
    setIsLoading(false);
    if (r.success) close();
    else setError(r.error || 'Wrong code');
  };

  const handleResend = async () => {
    if (!email) return;
    setResendNote('');
    setError('');
    const r = await resendTwoFactor(email);
    if (r.success && r.challengeId) {
      setTwoFactor((prev) => prev ? { ...prev, challengeId: r.challengeId!, deliveredTo: r.deliveredTo || prev.deliveredTo, channel: r.channel || prev.channel } : prev);
      setOtpCode('');
      setResendNote(`A new code was sent to ${r.deliveredTo}.`);
    } else {
      setError(r.error || 'Could not resend code');
    }
  };

  if (twoFactor) {
    return (
      <form onSubmit={handleVerify} className="space-y-2">
        <div className="rounded border border-primary/30 bg-primary/5 p-2 text-[11px]">
          We sent a 6-digit code to <strong>{twoFactor.deliveredTo}</strong>
          {twoFactor.channel === 'sms' ? ' via SMS.' : ' by email.'} Enter it below to finish signing in.
        </div>
        {twoFactor.warning && (
          <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-[10px] text-yellow-700 dark:text-yellow-300">
            {twoFactor.warning}
          </div>
        )}
        {error && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
        )}
        {resendNote && (
          <div className="rounded border border-success/30 bg-success/10 p-2 text-xs text-success">{resendNote}</div>
        )}
        <div className="space-y-1">
          <Label htmlFor="modal-otp" className="text-xs">Verification code</Label>
          <Input
            id="modal-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-9 text-center text-xl tracking-[0.4em] font-mono"
            required
            disabled={isLoading}
          />
        </div>
        <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={isLoading || otpCode.length !== 6}>
          {isLoading ? (<><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Verifying…</>) : 'Verify and sign in'}
        </Button>
        <div className="flex items-center justify-between text-[10px]">
          <button type="button" onClick={() => { setTwoFactor(null); setOtpCode(''); setError(''); }} className="text-muted-foreground hover:text-foreground hover:underline">Use a different account</button>
          <button type="button" onClick={handleResend} className="font-medium text-primary hover:underline">Resend code</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <SocialButtons mode="login" />
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {error && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="modal-email" className="text-xs">Email</Label>
          <Input
            id="modal-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="modal-password" className="text-xs">Password</Label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="modal-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-8 pr-10 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 select-none cursor-pointer text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
            className="h-3.5 w-3.5 rounded border border-input accent-primary"
          />
          <span>Keep me signed in for 30 days</span>
        </label>

        <CaptchaChallenge ref={captchaRef} visible={captchaRequired} />

        <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </>
  );
}

// In-modal panel used right after registration to confirm the email
// address. Accepts either the 6-digit code OR a click on the link in
// the email (handled separately by /verify-email page).
function VerifyEmailPanel({
  email,
  displayName,
  initialEmailStatus,
  onDone,
}: {
  email: string;
  displayName: string;
  initialEmailStatus?: 'sent' | 'skipped' | 'failed';
  onDone: () => void;
}) {
  const { verifyEmail, resendVerification } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<string>(() => {
    if (initialEmailStatus === 'sent') return `We sent a 6-digit code to ${email}.`;
    if (initialEmailStatus === 'skipped') return 'Email delivery is not yet configured. Ask an admin to set SMTP, then click resend.';
    if (initialEmailStatus === 'failed') return 'We had trouble sending the email. Try Resend below.';
    return `Check ${email} for a 6-digit verification code.`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError('');
    setSubmitting(true);
    const r = await verifyEmail(code);
    setSubmitting(false);
    if (r.success) {
      setDone(true);
      setInfo('Email verified — welcome aboard!');
      // Auto-close after a brief moment so the user sees the success state.
      setTimeout(onDone, 1200);
    } else {
      setError(r.error || 'Verification failed');
    }
  };

  const onResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    const r = await resendVerification();
    setResending(false);
    if (!r.success) {
      setError(r.error || 'Could not resend code');
      return;
    }
    if (r.emailStatus === 'sent') setInfo(`A fresh code is on the way to ${email}.`);
    else if (r.emailStatus === 'skipped') setInfo('Email delivery is not configured yet. Ask an admin to set SMTP.');
    else setInfo('Code requested. If it does not arrive, contact support.');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
        <p className="font-medium text-foreground">Welcome, {displayName}!</p>
        <p className="mt-1 text-muted-foreground">
          {info || `Check ${email} for a 6-digit verification code, or click the verify link inside.`}
        </p>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {done && (
        <div className="flex items-center gap-2 rounded border border-success/30 bg-success/10 p-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Email verified. You can close this window.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-2">
        <Label htmlFor="verify-code" className="text-xs">Verification code</Label>
        <Input
          id="verify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="h-10 text-center text-xl tracking-[0.4em] font-mono"
          disabled={submitting || done}
        />
        <Button type="submit" size="sm" className="w-full h-9 text-xs" disabled={submitting || code.length !== 6 || done}>
          {submitting ? (<><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Verifying…</>) : 'Verify email'}
        </Button>
      </form>

      <div className="flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={onResend}
          disabled={resending || done}
          className="font-medium text-primary hover:underline disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Resend code'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          I&apos;ll verify later
        </button>
      </div>
    </div>
  );
}

function RegisterPanel() {
  const { register } = useAuth();
  const { close } = useAuthModal();
  // After a successful sign-up we drop the user into the in-modal verify
  // panel rather than closing — they still need to confirm their email.
  const [postRegister, setPostRegister] = useState<{
    email: string;
    displayName: string;
    emailStatus?: 'sent' | 'skipped' | 'failed';
  } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    phone: '',
    countryCode: 'KE',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Live availability state for email + username (debounced)
  const [emailCheck, setEmailCheck] = useState<{ status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'; message?: string }>({ status: 'idle' });
  const [usernameCheck, setUsernameCheck] = useState<{ status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'; message?: string }>({ status: 'idle' });
  // Captcha is mandatory on signup — show it immediately so the user has time
  // to solve it while filling the rest of the form.
  const captchaRef = useRef<CaptchaChallengeHandle>(null);

  const selectedCountry = countries.find((c) => c.code === formData.countryCode);

  // Debounced live check for email
  useEffect(() => {
    const v = formData.email.trim();
    if (!v) { setEmailCheck({ status: 'idle' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailCheck({ status: 'invalid', message: 'Enter a valid email' });
      return;
    }
    setEmailCheck({ status: 'checking' });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-availability?email=${encodeURIComponent(v)}`, { signal: ctrl.signal });
        const d = await r.json();
        setEmailCheck({ status: d.email?.available ? 'available' : 'taken', message: d.email?.message });
      } catch {/* ignore */}
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [formData.email]);

  // Debounced live check for username
  useEffect(() => {
    const v = formData.username.trim();
    if (!v) { setUsernameCheck({ status: 'idle' }); return; }
    if (v.length < 3) {
      setUsernameCheck({ status: 'invalid', message: 'At least 3 characters' });
      return;
    }
    setUsernameCheck({ status: 'checking' });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-availability?username=${encodeURIComponent(v)}`, { signal: ctrl.signal });
        const d = await r.json();
        setUsernameCheck({ status: d.username?.available ? 'available' : 'taken', message: d.username?.message });
      } catch {/* ignore */}
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [formData.username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (emailCheck.status === 'taken') {
      setError('That email is already registered. Try signing in instead.');
      return;
    }
    if (usernameCheck.status === 'taken') {
      setError('That username is taken. Pick a different one.');
      return;
    }

    const captcha = captchaRef.current?.getResult();
    if (!captcha) {
      setError('Please complete the security check.');
      return;
    }

    setIsLoading(true);
    const result = await register({
      email: formData.email,
      password: formData.password,
      username: formData.username,
      displayName: formData.displayName,
      phone: formData.phone ? `${selectedCountry?.dialCode}${formData.phone}` : undefined,
      countryCode: formData.countryCode,
      captchaToken: captcha.token,
      captchaId: captcha.id,
    });
    setIsLoading(false);

    if (result.success) {
      // We deliberately don't close the modal here — the user is signed in
      // but unverified. Show the verify panel so they can enter the code.
      if (result.verifyRequired) {
        setPostRegister({
          email: formData.email,
          displayName: formData.displayName,
          emailStatus: result.emailStatus,
        });
      } else {
        close();
      }
    } else {
      setError(result.error || 'Registration failed');
      // Refresh the captcha so a stale answer can't be re-submitted.
      await captchaRef.current?.refresh();
    }
  };

  if (postRegister) {
    return (
      <VerifyEmailPanel
        email={postRegister.email}
        displayName={postRegister.displayName}
        initialEmailStatus={postRegister.emailStatus}
        onDone={close}
      />
    );
  }

  return (
    <>
      <SocialButtons mode="register" />
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {error && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="modal-reg-email" className="text-xs">Email</Label>
          <div className="relative">
            <Input
              id="modal-reg-email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              className="h-8 pr-8 text-xs"
            />
            <AvailabilityIndicator status={emailCheck.status} />
          </div>
          {emailCheck.status === 'taken' && (
            <p className="text-[10px] text-destructive leading-tight">{emailCheck.message || 'Email already registered'}</p>
          )}
          {emailCheck.status === 'available' && (
            <p className="text-[10px] text-success leading-tight">Email available</p>
          )}
          {emailCheck.status === 'invalid' && (
            <p className="text-[10px] text-destructive leading-tight">{emailCheck.message}</p>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="modal-reg-username" className="text-xs">
              Username <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="modal-reg-username"
                placeholder="e.g. tipsking254"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                required
                disabled={isLoading}
                maxLength={20}
                className="h-8 pr-8 text-xs"
              />
              <AvailabilityIndicator status={usernameCheck.status} />
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {usernameCheck.status === 'available' ? <span className="text-success">Username available</span>
                : usernameCheck.status === 'taken' ? <span className="text-destructive">{usernameCheck.message || 'Username taken'}</span>
                : usernameCheck.status === 'invalid' ? <span className="text-destructive">{usernameCheck.message}</span>
                : 'Lowercase, letters, numbers, underscore.'}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="modal-reg-display" className="text-xs">
              Display name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="modal-reg-display"
              placeholder="e.g. Tips King"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
              disabled={isLoading}
              maxLength={40}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              The name shown on your tips.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="modal-reg-phone" className="text-xs">Phone (optional)</Label>
          <div className="flex gap-1.5">
            <Select
              value={formData.countryCode}
              onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
            >
              <SelectTrigger className="h-8 w-24 text-[11px] px-2">
                <SelectValue>
                  <span className="flex items-center gap-1">
                    <span>{selectedCountry?.code}</span>
                    <span className="text-muted-foreground text-[10px]">{selectedCountry?.dialCode}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span>{country.code}</span>
                      <span className="text-muted-foreground">{country.dialCode}</span>
                      <span className="text-muted-foreground">{country.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="modal-reg-phone"
              type="tel"
              placeholder="712345678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
              disabled={isLoading}
              className="h-8 flex-1 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="modal-reg-password" className="text-xs">Password</Label>
          <div className="relative">
            <Input
              id="modal-reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading}
              className="h-8 pr-10 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <CaptchaChallenge ref={captchaRef} visible />

        <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </>
  );
}

function AvailabilityIndicator({ status }: { status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' }) {
  if (status === 'idle') return null;
  return (
    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
      {status === 'checking' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {status === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
      {(status === 'taken' || status === 'invalid') && <XCircle className="h-3.5 w-3.5 text-destructive" />}
    </div>
  );
}

function ForgotPanel() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || 'Could not send reset email');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-2 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
        <p className="text-xs text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, a password
          reset link is on its way. Check your inbox (and spam folder).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="modal-forgot-email" className="text-xs">Email</Label>
        <Input
          id="modal-forgot-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="h-8 text-xs"
        />
      </div>
      <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Sending link...
          </>
        ) : (
          'Send reset link'
        )}
      </Button>
    </form>
  );
}

function ResetPanel() {
  const { close } = useAuthModal();
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('reset_token') || '';
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setError(data.error || 'Reset failed');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-2 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
        <p className="text-xs text-muted-foreground">Your password has been updated. You can now sign in.</p>
        <Button onClick={close} size="sm" className="w-full h-8 text-xs">Close</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {!token && (
        <div className="space-y-1">
          <Label htmlFor="modal-reset-token" className="text-xs">Reset token</Label>
          <Input
            id="modal-reset-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the token from your email"
            required
            className="h-8 text-xs"
          />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="modal-reset-pw" className="text-xs">New password</Label>
        <Input
          id="modal-reset-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="modal-reset-confirm" className="text-xs">Confirm password</Label>
        <Input
          id="modal-reset-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="h-8 text-xs"
        />
      </div>
      <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={isLoading}>
        {isLoading ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Updating...</> : 'Update password'}
      </Button>
    </form>
  );
}
