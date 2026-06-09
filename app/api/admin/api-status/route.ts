import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, query } from '@/lib/db';
import { getEmailConfig } from '@/lib/email-config-store';
import { getOAuthConfig as getOAuthAllConfig } from '@/lib/oauth-config-store';
import { isTheOddsApiQuotaExhausted, getApiStatus } from '@/lib/api/unified-sports-api';
import { getApiKey } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';

type IntegrationStatus = 'ok' | 'error' | 'missing' | 'quota' | 'disabled';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  message: string;
  detail?: string;
  configLink?: string;
}

async function check(fn: () => Promise<IntegrationItem>): Promise<IntegrationItem> {
  try {
    return await fn();
  } catch (e) {
    return { id: 'unknown', name: 'Unknown', category: '', status: 'error', message: String(e) };
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const items: IntegrationItem[] = await Promise.all([

    // ── Infrastructure ─────────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const pool = getPool();
      if (!pool) {
        return { id: 'database', name: 'MySQL Database', category: 'Infrastructure', status: 'missing', message: 'No DB pool — running in memory-only mode', configLink: '/admin/database' };
      }
      try {
        await query('SELECT 1');
        const host = process.env.DB_HOST || '?';
        return { id: 'database', name: 'MySQL Database', category: 'Infrastructure', status: 'ok', message: 'Connected and responding', detail: `Host: ${host}`, configLink: '/admin/database' };
      } catch (e) {
        return { id: 'database', name: 'MySQL Database', category: 'Infrastructure', status: 'error', message: `Connection failed: ${(e as Error).message}`, configLink: '/admin/database' };
      }
    }),

    check(async (): Promise<IntegrationItem> => {
      const secret = process.env.JWT_SECRET || '';
      if (!secret || secret.length < 16) {
        return { id: 'jwt', name: 'JWT Auth Secret', category: 'Infrastructure', status: 'missing', message: 'JWT_SECRET env var not set or too short' };
      }
      return { id: 'jwt', name: 'JWT Auth Secret', category: 'Infrastructure', status: 'ok', message: 'Secret configured', detail: `Length: ${secret.length} chars` };
    }),

    // ── Sports Data APIs ────────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const sportsStatus = getApiStatus();
      return {
        id: 'espn', name: 'ESPN Sports API', category: 'Sports Data',
        status: sportsStatus.espn.working ? 'ok' : 'error',
        message: sportsStatus.espn.working ? 'Free API — no key required' : `Error: ${sportsStatus.espn.lastError}`,
        detail: 'Primary source for live matches & scores',
      };
    }),

    check(async (): Promise<IntegrationItem> => {
      const key = await getApiKey('the_odds_api_key');
      if (!key || key === 'your_api_key_here') {
        return { id: 'the_odds_api', name: 'TheOddsAPI', category: 'Sports Data', status: 'missing', message: 'API key not configured', configLink: '/admin/settings' };
      }
      if (isTheOddsApiQuotaExhausted()) {
        return { id: 'the_odds_api', name: 'TheOddsAPI', category: 'Sports Data', status: 'quota', message: 'Monthly quota exhausted — resumes next billing cycle', detail: `Key: ${key.slice(0, 6)}…`, configLink: '/admin/settings' };
      }
      const sportsStatus = getApiStatus();
      return {
        id: 'the_odds_api', name: 'TheOddsAPI', category: 'Sports Data',
        status: sportsStatus.theOddsApi.working ? 'ok' : 'error',
        message: sportsStatus.theOddsApi.working ? 'Key valid, quota available' : (sportsStatus.theOddsApi.lastError || 'Key present but API check failed'),
        detail: `Key: ${key.slice(0, 6)}…`,
        configLink: '/admin/settings',
      };
    }),

    check(async (): Promise<IntegrationItem> => {
      const key = await getApiKey('football_data_api_key');
      if (!key) {
        return { id: 'football_data', name: 'Football-Data.org', category: 'Sports Data', status: 'missing', message: 'API key not configured', configLink: '/admin/settings' };
      }
      return { id: 'football_data', name: 'Football-Data.org', category: 'Sports Data', status: 'ok', message: 'Key configured', detail: `Key: ${key.slice(0, 6)}…`, configLink: '/admin/settings' };
    }),

    check(async (): Promise<IntegrationItem> => {
      const key = await getApiKey('sportsgameodds_api_key');
      if (!key) {
        return { id: 'sportsgameodds', name: 'SportsGameOdds', category: 'Sports Data', status: 'missing', message: 'API key not configured', configLink: '/admin/settings' };
      }
      return { id: 'sportsgameodds', name: 'SportsGameOdds', category: 'Sports Data', status: 'ok', message: 'Key configured', detail: `Key: ${key.slice(0, 6)}…`, configLink: '/admin/settings' };
    }),

    check(async (): Promise<IntegrationItem> => {
      const key = await getApiKey('sharp_api_key');
      if (!key) {
        return { id: 'sharpapi', name: 'SharpAPI (DraftKings/FanDuel)', category: 'Sports Data', status: 'missing', message: 'API key not configured — optional odds supplement', configLink: '/admin/settings' };
      }
      try {
        const { testSharpApiKey } = await import('@/lib/api/sharpapi');
        const result = await testSharpApiKey();
        return {
          id: 'sharpapi',
          name: 'SharpAPI (DraftKings/FanDuel)',
          category: 'Sports Data',
          status: result.ok ? 'ok' : 'error',
          message: result.message,
          detail: result.detail || `Key: ${key.slice(0, 8)}…`,
          configLink: '/admin/settings',
        };
      } catch {
        return { id: 'sharpapi', name: 'SharpAPI (DraftKings/FanDuel)', category: 'Sports Data', status: 'ok', message: 'Key configured', detail: `Key: ${key.slice(0, 8)}…`, configLink: '/admin/settings' };
      }
    }),

    // ── AI ──────────────────────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const key = await getApiKey('openai_api_key');
      if (!key) {
        return { id: 'openai', name: 'OpenAI (AI Predictions)', category: 'AI', status: 'missing', message: 'API key not configured — AI tips disabled', configLink: '/admin/settings' };
      }
      return { id: 'openai', name: 'OpenAI (AI Predictions)', category: 'AI', status: 'ok', message: 'Key configured', detail: `Key: ${key.slice(0, 8)}…`, configLink: '/admin/settings' };
    }),

    // ── Payments ────────────────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const token = process.env.PAYHERO_BASIC_TOKEN || '';
      const channelId = process.env.PAYHERO_CHANNEL_ID || process.env.PAYHERO_ACCOUNT_ID || '';
      if (!token) {
        return { id: 'payhero', name: 'PayHero (M-Pesa)', category: 'Payments', status: 'missing', message: 'PAYHERO_BASIC_TOKEN not set', configLink: '/admin/payment-gateways' };
      }
      if (!channelId || channelId === '0') {
        return { id: 'payhero', name: 'PayHero (M-Pesa)', category: 'Payments', status: 'error', message: 'Token set but Channel ID missing', configLink: '/admin/payment-gateways' };
      }
      return { id: 'payhero', name: 'PayHero (M-Pesa)', category: 'Payments', status: 'ok', message: 'Token and Channel ID configured', detail: `Channel: ${channelId}`, configLink: '/admin/payment-gateways' };
    }),

    // ── Push Notifications ─────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const pub = process.env.VAPID_PUBLIC_KEY || '';
      const priv = process.env.VAPID_PRIVATE_KEY || '';
      if (!pub || !priv) {
        return { id: 'vapid', name: 'VAPID Push Notifications', category: 'Notifications', status: 'missing', message: `Missing: ${[!pub && 'VAPID_PUBLIC_KEY', !priv && 'VAPID_PRIVATE_KEY'].filter(Boolean).join(', ')}` };
      }
      return { id: 'vapid', name: 'VAPID Push Notifications', category: 'Notifications', status: 'ok', message: 'Public + private keys configured', detail: `Public key: ${pub.slice(0, 12)}…` };
    }),

    // ── Email / SMTP ────────────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const cfg = await getEmailConfig();
      if (!cfg.host || !cfg.username) {
        return { id: 'smtp', name: 'SMTP Email', category: 'Notifications', status: 'missing', message: 'SMTP not configured — transactional email disabled', configLink: '/admin/email-config' };
      }
      if (!cfg.enabled) {
        return { id: 'smtp', name: 'SMTP Email', category: 'Notifications', status: 'disabled', message: 'SMTP configured but disabled', detail: `Host: ${cfg.host}`, configLink: '/admin/email-config' };
      }
      return { id: 'smtp', name: 'SMTP Email', category: 'Notifications', status: 'ok', message: 'Enabled and configured', detail: `${cfg.host}:${cfg.port} — from ${cfg.fromEmail}`, configLink: '/admin/email-config' };
    }),

    // ── Bot Protection ─────────────────────────────────────────────
    check(async (): Promise<IntegrationItem> => {
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || await getApiKey('turnstile_site_key');
      const secretKey = process.env.TURNSTILE_SECRET_KEY || await getApiKey('turnstile_secret_key');
      const rSite = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || await getApiKey('recaptcha_site_key');
      const rSecret = process.env.RECAPTCHA_SECRET_KEY || await getApiKey('recaptcha_secret_key');

      if (siteKey && secretKey) {
        return { id: 'captcha', name: 'Cloudflare Turnstile', category: 'Security', status: 'ok', message: 'Site key + secret configured', detail: `Key: ${siteKey.slice(0, 10)}…`, configLink: '/admin/settings' };
      }
      if (rSite && rSecret) {
        return { id: 'captcha', name: 'reCAPTCHA', category: 'Security', status: 'ok', message: 'Site key + secret configured', detail: `Key: ${rSite.slice(0, 10)}…`, configLink: '/admin/settings' };
      }
      return { id: 'captcha', name: 'Bot Protection (Captcha)', category: 'Security', status: 'missing', message: 'No captcha configured — login/signup are unprotected', configLink: '/admin/settings' };
    }),

    // ── Social OAuth ───────────────────────────────────────────────
    ...(await (async () => {
      const cfg = await getOAuthAllConfig();
      const SOCIAL_META: Array<{ id: string; name: string; emoji: string }> = [
        { id: 'google', name: 'Google OAuth', emoji: '🟦' },
        { id: 'facebook', name: 'Facebook OAuth', emoji: '🟦' },
        { id: 'github', name: 'GitHub OAuth', emoji: '⚫' },
        { id: 'apple', name: 'Apple Sign-In', emoji: '⚪' },
        { id: 'twitter', name: 'X (Twitter) OAuth', emoji: '⚫' },
        { id: 'discord', name: 'Discord OAuth', emoji: '🟣' },
        { id: 'linkedin', name: 'LinkedIn OAuth', emoji: '🟦' },
        { id: 'microsoft', name: 'Microsoft OAuth', emoji: '🟦' },
      ];
      return SOCIAL_META.map(({ id, name }): IntegrationItem => {
        const p = cfg[id as keyof typeof cfg];
        if (!p) return { id: `social_${id}`, name, category: 'Social Login', status: 'missing', message: 'Not configured', configLink: '/admin/social-login' };
        if (!p.enabled) return { id: `social_${id}`, name, category: 'Social Login', status: 'disabled', message: 'Configured but disabled', detail: p.clientId ? `Client ID: ${p.clientId.slice(0, 8)}…` : undefined, configLink: '/admin/social-login' };
        if (!p.clientId || !p.clientSecret) return { id: `social_${id}`, name, category: 'Social Login', status: 'error', message: 'Enabled but missing client ID or secret', configLink: '/admin/social-login' };
        return { id: `social_${id}`, name, category: 'Social Login', status: 'ok', message: 'Enabled and configured', detail: `Client ID: ${p.clientId.slice(0, 8)}…`, configLink: '/admin/social-login' };
      });
    })()),
  ]);

  const summary = items.reduce<Record<string, number>>(
    (acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; },
    {}
  );

  return NextResponse.json({ items, summary, checkedAt: new Date().toISOString() });
}
