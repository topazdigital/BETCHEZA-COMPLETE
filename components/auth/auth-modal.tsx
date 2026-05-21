'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
  { code: 'AF', name: 'Afghanistan', dialCode: '+93', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dialCode: '+355', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', dialCode: '+213', flag: '🇩🇿' },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', dialCode: '+374', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', dialCode: '+994', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', dialCode: '+375', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪' },
  { code: 'BZ', name: 'Belize', dialCode: '+501', flag: '🇧🇿' },
  { code: 'BJ', name: 'Benin', dialCode: '+229', flag: '🇧🇯' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia & Herzegovina', dialCode: '+387', flag: '🇧🇦' },
  { code: 'BW', name: 'Botswana', dialCode: '+267', flag: '🇧🇼' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'BN', name: 'Brunei', dialCode: '+673', flag: '🇧🇳' },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359', flag: '🇧🇬' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫' },
  { code: 'BI', name: 'Burundi', dialCode: '+257', flag: '🇧🇮' },
  { code: 'CM', name: 'Cameroon', dialCode: '+237', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { code: 'CV', name: 'Cape Verde', dialCode: '+238', flag: '🇨🇻' },
  { code: 'CF', name: 'Central African Republic', dialCode: '+236', flag: '🇨🇫' },
  { code: 'TD', name: 'Chad', dialCode: '+235', flag: '🇹🇩' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { code: 'CG', name: 'Congo', dialCode: '+242', flag: '🇨🇬' },
  { code: 'CD', name: 'Congo (DR)', dialCode: '+243', flag: '🇨🇩' },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮' },
  { code: 'HR', name: 'Croatia', dialCode: '+385', flag: '🇭🇷' },
  { code: 'CY', name: 'Cyprus', dialCode: '+357', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', flag: '🇩🇯' },
  { code: 'DO', name: 'Dominican Republic', dialCode: '+1-809', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻' },
  { code: 'GQ', name: 'Equatorial Guinea', dialCode: '+240', flag: '🇬🇶' },
  { code: 'ER', name: 'Eritrea', dialCode: '+291', flag: '🇪🇷' },
  { code: 'EE', name: 'Estonia', dialCode: '+372', flag: '🇪🇪' },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'GA', name: 'Gabon', dialCode: '+241', flag: '🇬🇦' },
  { code: 'GM', name: 'Gambia', dialCode: '+220', flag: '🇬🇲' },
  { code: 'GE', name: 'Georgia', dialCode: '+995', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹' },
  { code: 'GN', name: 'Guinea', dialCode: '+224', flag: '🇬🇳' },
  { code: 'GW', name: 'Guinea-Bissau', dialCode: '+245', flag: '🇬🇼' },
  { code: 'GY', name: 'Guyana', dialCode: '+592', flag: '🇬🇾' },
  { code: 'HT', name: 'Haiti', dialCode: '+509', flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', dialCode: '+354', flag: '🇮🇸' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', dialCode: '+98', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', dialCode: '+964', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1-876', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', dialCode: '+962', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', dialCode: '+7', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan', dialCode: '+996', flag: '🇰🇬' },
  { code: 'LA', name: 'Laos', dialCode: '+856', flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia', dialCode: '+371', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', dialCode: '+961', flag: '🇱🇧' },
  { code: 'LS', name: 'Lesotho', dialCode: '+266', flag: '🇱🇸' },
  { code: 'LR', name: 'Liberia', dialCode: '+231', flag: '🇱🇷' },
  { code: 'LY', name: 'Libya', dialCode: '+218', flag: '🇱🇾' },
  { code: 'LT', name: 'Lithuania', dialCode: '+370', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺' },
  { code: 'MO', name: 'Macau', dialCode: '+853', flag: '🇲🇴' },
  { code: 'MG', name: 'Madagascar', dialCode: '+261', flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi', dialCode: '+265', flag: '🇲🇼' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives', dialCode: '+960', flag: '🇲🇻' },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱' },
  { code: 'MT', name: 'Malta', dialCode: '+356', flag: '🇲🇹' },
  { code: 'MR', name: 'Mauritania', dialCode: '+222', flag: '🇲🇷' },
  { code: 'MU', name: 'Mauritius', dialCode: '+230', flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { code: 'MD', name: 'Moldova', dialCode: '+373', flag: '🇲🇩' },
  { code: 'MN', name: 'Mongolia', dialCode: '+976', flag: '🇲🇳' },
  { code: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿' },
  { code: 'MM', name: 'Myanmar', dialCode: '+95', flag: '🇲🇲' },
  { code: 'NA', name: 'Namibia', dialCode: '+264', flag: '🇳🇦' },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮' },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
  { code: 'PA', name: 'Panama', dialCode: '+507', flag: '🇵🇦' },
  { code: 'PG', name: 'Papua New Guinea', dialCode: '+675', flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', dialCode: '+221', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', dialCode: '+381', flag: '🇷🇸' },
  { code: 'SL', name: 'Sierra Leone', dialCode: '+232', flag: '🇸🇱' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', dialCode: '+421', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', dialCode: '+386', flag: '🇸🇮' },
  { code: 'SO', name: 'Somalia', dialCode: '+252', flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'SS', name: 'South Sudan', dialCode: '+211', flag: '🇸🇸' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰' },
  { code: 'SD', name: 'Sudan', dialCode: '+249', flag: '🇸🇩' },
  { code: 'SZ', name: 'Swaziland', dialCode: '+268', flag: '🇸🇿' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', dialCode: '+963', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼' },
  { code: 'TJ', name: 'Tajikistan', dialCode: '+992', flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬' },
  { code: 'TT', name: 'Trinidad & Tobago', dialCode: '+1-868', flag: '🇹🇹' },
  { code: 'TN', name: 'Tunisia', dialCode: '+216', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan', dialCode: '+993', flag: '🇹🇲' },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan', dialCode: '+998', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dialCode: '+967', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', dialCode: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼' },
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
  const { isAuthenticated } = useAuth();
  const meta = TITLES[view] || TITLES.login;

  // Auto-close the modal when the user becomes authenticated
  // BUT NOT on the register view — after sign-up the user is immediately
  // authenticated while still needing to verify their email. Closing here
  // would swallow the VerifyEmailPanel before the user ever sees it.
  useEffect(() => {
    if (isAuthenticated && isOpen && view !== 'register') {
      close();
    }
  }, [isAuthenticated, isOpen, close, view]);

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

type LoginTab = 'email' | 'phone' | 'username';

function LoginPanel() {
  const { login, completeTwoFactor, resendTwoFactor } = useAuth();
  const { close, setView } = useAuthModal();
  const [loginTab, setLoginTab] = useState<LoginTab>('email');
  const [identifier, setIdentifier] = useState('');
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
  const [rememberMe, setRememberMe] = useState(true);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const captchaRef = useRef<CaptchaChallengeHandle>(null);

  // Phone tab: country picker (same pattern as RegisterPanel)
  const [loginPhoneCode, setLoginPhoneCode] = useState('KE');
  const [loginPhoneLocal, setLoginPhoneLocal] = useState('');
  const [loginCountrySearch, setLoginCountrySearch] = useState('');
  const [loginCountryOpen, setLoginCountryOpen] = useState(false);
  const loginCountryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLoginPhoneCode(detectCountryCode()); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loginCountryRef.current && !loginCountryRef.current.contains(e.target as Node)) {
        setLoginCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLoginCountry = countries.find(c => c.code === loginPhoneCode);
  const filteredLoginCountries = loginCountrySearch.trim()
    ? countries.filter(c =>
        c.name.toLowerCase().includes(loginCountrySearch.toLowerCase()) ||
        c.dialCode.includes(loginCountrySearch) ||
        c.code.toLowerCase().includes(loginCountrySearch.toLowerCase())
      )
    : countries;

  const tabLabels: Record<LoginTab, string> = { email: 'Email', phone: 'Phone', username: 'Username' };
  const tabPlaceholders: Record<LoginTab, string> = { email: 'you@example.com', phone: '7XX XXX XXX', username: 'your_username' };
  const tabInputTypes: Record<LoginTab, string> = { email: 'email', phone: 'tel', username: 'text' };

  const handleTabChange = (tab: LoginTab) => {
    setLoginTab(tab);
    setIdentifier('');
    setLoginPhoneLocal('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const currentInput = loginTab === 'phone' ? loginPhoneLocal.trim() : identifier.trim();
    if (!currentInput) {
      setError(loginTab === 'phone' ? 'Please enter your phone number' : `Please enter your ${tabLabels[loginTab].toLowerCase()}`);
      return;
    }
    let captcha: { token: string; id?: string } | undefined;
    if (captchaRequired) {
      const r = captchaRef.current?.getResult();
      if (!r) {
        setError('Please complete the security check.');
        return;
      }
      captcha = r;
    }
    const fullIdentifier = loginTab === 'phone'
      ? (selectedLoginCountry?.dialCode || '+254') + loginPhoneLocal.replace(/[^\d]/g, '')
      : identifier.trim();
    setIsLoading(true);
    const result = await login(fullIdentifier, password, captcha, { rememberMe, loginType: loginTab });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Login failed');
      if (result.captchaRequired) {
        setCaptchaRequired(true);
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
    const resendIdentifier = loginTab === 'phone'
      ? (selectedLoginCountry?.dialCode || '') + loginPhoneLocal.replace(/[^\d]/g, '')
      : identifier;
    if (!resendIdentifier) return;
    setResendNote('');
    setError('');
    const r = await resendTwoFactor(resendIdentifier);
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

        {/* Login method tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
          {(['email', 'phone', 'username'] as LoginTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-1.5 font-medium transition-colors capitalize ${
                loginTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="modal-identifier" className="text-xs">{tabLabels[loginTab]}</Label>
          {loginTab === 'phone' ? (
            <div className="flex gap-1.5">
              <div className="relative" ref={loginCountryRef}>
                <button
                  type="button"
                  onClick={() => setLoginCountryOpen(o => !o)}
                  disabled={isLoading}
                  className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <span>{selectedLoginCountry?.flag}</span>
                  <span className="text-muted-foreground">{selectedLoginCountry?.dialCode}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {loginCountryOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    <div className="sticky top-0 border-b border-border bg-popover p-1">
                      <input
                        autoFocus
                        value={loginCountrySearch}
                        onChange={e => setLoginCountrySearch(e.target.value)}
                        placeholder="Search country or code..."
                        className="w-full rounded-sm border border-border px-2 py-1 text-[11px] outline-none focus:border-primary"
                      />
                    </div>
                    {filteredLoginCountries.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { setLoginPhoneCode(c.code); setLoginCountryOpen(false); setLoginCountrySearch(''); }}
                        className={`flex w-full items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-muted ${loginPhoneCode === c.code ? 'bg-primary/10 font-semibold' : ''}`}
                      >
                        <span>{c.flag}</span>
                        <span className="flex-1 truncate text-left">{c.name}</span>
                        <span className="text-muted-foreground">{c.dialCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                id="modal-identifier"
                type="tel"
                placeholder="7XX XXX XXX"
                value={loginPhoneLocal}
                onChange={e => setLoginPhoneLocal(e.target.value.replace(/[^\d\s]/g, ''))}
                autoComplete="tel-national"
                required
                disabled={isLoading}
                className="h-8 flex-1 text-xs"
              />
            </div>
          ) : (
            <Input
              id="modal-identifier"
              type={tabInputTypes[loginTab]}
              placeholder={tabPlaceholders[loginTab]}
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              autoComplete={loginTab === 'email' ? 'email' : 'username'}
              required
              disabled={isLoading}
              className="h-8 text-xs"
            />
          )}
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
        <span className="text-[10px] text-muted-foreground">Check spam if you don&apos;t see it</span>
      </div>
    </div>
  );
}

// Timezone → ISO country code mapping for reliable geo-detection
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Africa
  'Africa/Nairobi': 'KE', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH',
  'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ', 'Africa/Tunis': 'TN', 'Africa/Addis_Ababa': 'ET',
  'Africa/Kampala': 'UG', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kigali': 'RW',
  'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW', 'Africa/Douala': 'CM',
  'Africa/Abidjan': 'CI', 'Africa/Dakar': 'SN', 'Africa/Maputo': 'MZ',
  'Africa/Luanda': 'AO', 'Africa/Libreville': 'GA', 'Africa/Bamako': 'ML',
  'Africa/Ouagadougou': 'BF', 'Africa/Conakry': 'GN', 'Africa/Freetown': 'SL',
  'Africa/Lome': 'TG', 'Africa/Porto-Novo': 'BJ', 'Africa/Banjul': 'GM',
  'Africa/Bissau': 'GW', 'Africa/Mogadishu': 'SO', 'Africa/Djibouti': 'DJ',
  'Africa/Asmara': 'ER', 'Africa/Juba': 'SS', 'Africa/Khartoum': 'SD',
  'Africa/Tripoli': 'LY', 'Africa/Mbabane': 'SZ', 'Africa/Blantyre': 'MW',
  'Africa/Gaborone': 'BW', 'Africa/Windhoek': 'NA',
  // Europe
  'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT',
  'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR', 'Europe/Kiev': 'UA', 'Europe/Moscow': 'RU',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI', 'Europe/Lisbon': 'PT', 'Europe/Dublin': 'IE',
  'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT', 'Europe/Tallinn': 'EE',
  'Europe/Minsk': 'BY', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR',
  'Europe/Sarajevo': 'BA', 'Europe/Skopje': 'MK', 'Europe/Tirane': 'AL',
  'Europe/Chisinau': 'MD', 'Europe/Nicosia': 'CY', 'Europe/Luxembourg': 'LU',
  'Europe/Bratislava': 'SK', 'Europe/Ljubljana': 'SI',
  // Americas
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'America/Honolulu': 'US', 'America/Detroit': 'US', 'America/Indiana/Indianapolis': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Montreal': 'CA',
  'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/Edmonton': 'CA',
  'America/Mexico_City': 'MX', 'America/Monterrey': 'MX', 'America/Tijuana': 'MX',
  'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Santiago': 'CL',
  'America/Caracas': 'VE', 'America/La_Paz': 'BO', 'America/Asuncion': 'PY',
  'America/Montevideo': 'UY', 'America/Guayaquil': 'EC', 'America/Sao_Paulo': 'BR',
  'America/Manaus': 'BR', 'America/Belem': 'BR', 'America/Buenos_Aires': 'AR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Guatemala': 'GT',
  'America/El_Salvador': 'SV', 'America/Tegucigalpa': 'HN',
  'America/Managua': 'NI', 'America/Costa_Rica': 'CR', 'America/Panama': 'PA',
  'America/Santo_Domingo': 'DO', 'America/Port-au-Prince': 'HT',
  'America/Havana': 'CU', 'America/Kingston': 'JM', 'America/Guyana': 'GY',
  // Asia
  'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH', 'Asia/Qatar': 'QA', 'Asia/Muscat': 'OM',
  'Asia/Baghdad': 'IQ', 'Asia/Tehran': 'IR', 'Asia/Jerusalem': 'IL',
  'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY',
  'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD', 'Asia/Kathmandu': 'NP', 'Asia/Colombo': 'LK',
  'Asia/Kabul': 'AF', 'Asia/Tashkent': 'UZ', 'Asia/Almaty': 'KZ',
  'Asia/Bishkek': 'KG', 'Asia/Dushanbe': 'TJ', 'Asia/Ashgabat': 'TM',
  'Asia/Baku': 'AZ', 'Asia/Yerevan': 'AM', 'Asia/Tbilisi': 'GE',
  'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Jakarta': 'ID',
  'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH',
  'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Seoul': 'KR',
  'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Ulaanbaatar': 'MN',
  'Asia/Rangoon': 'MM', 'Asia/Yangon': 'MM', 'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID',
  'Asia/Macau': 'MO', 'Asia/Brunei': 'BN', 'Asia/Dili': 'TL',
  // Oceania
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Darwin': 'AU',
  'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ',
};

// Detect country from browser timezone (most reliable), then locale fallback
function detectCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) return TIMEZONE_TO_COUNTRY[tz];
    // Try partial match (e.g. "Africa/Nairobi" → any "Africa/..." prefix)
    const region = tz?.split('/')[0];
    if (region) {
      const match = Object.entries(TIMEZONE_TO_COUNTRY).find(([k]) => k.startsWith(region + '/') && k === tz);
      if (match) return match[1];
    }
  } catch {}
  // Fallback: browser locale (e.g. "en-KE" → "KE")
  try {
    const lang = navigator.language || '';
    const parts = lang.split('-');
    if (parts.length >= 2) {
      const code = parts[parts.length - 1].toUpperCase();
      if (countries.find(c => c.code === code)) return code;
    }
  } catch {}
  return 'KE';
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
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  // Live availability state for email + username (debounced)
  const [emailCheck, setEmailCheck] = useState<{ status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'; message?: string }>({ status: 'idle' });
  const [usernameCheck, setUsernameCheck] = useState<{ status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'; message?: string }>({ status: 'idle' });
  // Captcha is mandatory on signup — show it immediately so the user has time
  // to solve it while filling the rest of the form.
  const captchaRef = useRef<CaptchaChallengeHandle>(null);

  // Auto-detect country on first mount
  useEffect(() => {
    setFormData(f => ({ ...f, countryCode: detectCountryCode() }));
  }, []);

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCountry = countries.find((c) => c.code === formData.countryCode);
  const filteredCountries = countrySearch.trim()
    ? countries.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.dialCode.includes(countrySearch) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : countries;

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
    if (!formData.phone.trim()) {
      setError('Phone number is required');
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
          <Label htmlFor="modal-reg-phone" className="text-xs">
            Phone <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-1.5">
            {/* Custom country picker with flag + search */}
            <div className="relative" ref={countryRef}>
              <button
                type="button"
                onClick={() => setCountryOpen(o => !o)}
                disabled={isLoading}
                className="flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {selectedCountry && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`}
                    width={20}
                    height={15}
                    alt={selectedCountry.name}
                    className="rounded-[2px] object-cover"
                  />
                )}
                <span className="text-muted-foreground">{selectedCountry?.dialCode}</span>
                <span className="text-muted-foreground text-[9px]">▾</span>
              </button>
              {countryOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg">
                  <div className="p-1.5">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search country or code…"
                      value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCountries.length === 0 ? (
                      <p className="py-2 text-center text-[10px] text-muted-foreground">No results</p>
                    ) : filteredCountries.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setFormData(f => ({ ...f, countryCode: c.code }));
                          setCountryOpen(false);
                          setCountrySearch('');
                        }}
                        className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted ${formData.countryCode === c.code ? 'bg-primary/10 text-primary font-medium' : ''}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`}
                          width={20}
                          height={15}
                          alt={c.name}
                          className="rounded-[2px] object-cover shrink-0"
                        />
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="shrink-0 text-muted-foreground text-[10px]">{c.dialCode}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Input
              id="modal-reg-phone"
              type="tel"
              placeholder="712345678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
              required
              disabled={isLoading}
              className="h-8 flex-1 text-xs"
            />
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">Used for account recovery and SMS alerts.</p>
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
