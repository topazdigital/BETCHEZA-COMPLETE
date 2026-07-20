'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type AuthModalView = 'login' | 'register' | 'forgot' | 'reset';

interface AuthModalContextType {
  isOpen: boolean;
  view: AuthModalView;
  open: (view?: AuthModalView) => void;
  close: () => void;
  setView: (view: AuthModalView) => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthModalView>('login');

  const open = useCallback((next: AuthModalView = 'login') => {
    setView(next);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  // Open the modal automatically when the URL has ?auth=login|register|forgot|reset
  // or a bare ?reset_token=... (password-reset email link).
  // Also handles ?auth_error=... from failed OAuth flows (shows login view + error banner).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('auth');
    const hasResetToken = !!params.get('reset_token');
    const authError = params.get('auth_error');

    if (v === 'login' || v === 'register' || v === 'forgot' || v === 'reset') {
      setView(v);
      setIsOpen(true);
      // Keep reset_token in URL so the reset form can read it; strip auth param.
      params.delete('auth');
      const next = params.toString();
      const url = window.location.pathname + (next ? `?${next}` : '');
      window.history.replaceState(null, '', url);
    } else if (hasResetToken) {
      // Bare reset_token without auth param — still open the reset view.
      setView('reset');
      setIsOpen(true);
    } else if (authError) {
      // OAuth callback failure — open the login view so the user can try again.
      // The auth modal will display the error from sessionStorage if it set it.
      setView('login');
      setIsOpen(true);
      // Store the error message in sessionStorage so the auth modal can show it.
      try {
        const msg = authError === 'email_taken'
          ? 'An account with this email already exists. Please sign in with your password.'
          : authError === 'provider_error'
          ? 'Google sign-in failed. Please try again or use email/password.'
          : authError === 'missing_email'
          ? 'Google did not provide an email address. Please use email/password sign-in.'
          : 'Sign-in failed. Please try again.';
        sessionStorage.setItem('auth_error_msg', msg);
      } catch { /* ignore */ }
      // Strip auth_error from URL so it doesn't persist on reload.
      params.delete('auth_error');
      const next = params.toString();
      const url = window.location.pathname + (next ? `?${next}` : '');
      window.history.replaceState(null, '', url);
    }
  }, []);

  return (
    <AuthModalContext.Provider value={{ isOpen, view, open, close, setView }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within an AuthModalProvider');
  return ctx;
}
