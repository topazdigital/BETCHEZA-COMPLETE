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

  // Open the modal automatically when the URL has ?auth=login|register|forgot.
  // Used by the legacy /login and /register routes which now redirect with
  // that query so the page background stays visible behind the dialog.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('auth');
    if (v === 'login' || v === 'register' || v === 'forgot' || v === 'reset') {
      setView(v);
      setIsOpen(true);
      // Clean the URL so refreshes don't re-open the dialog.
      params.delete('auth');
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
