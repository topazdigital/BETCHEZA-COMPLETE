import { query, execute, getPool } from './db';

export type StaticPageSlug = 'about' | 'terms' | 'privacy' | 'responsible-gambling' | 'faq' | 'contact' | 'cookies';

export const STATIC_PAGE_SLUGS: StaticPageSlug[] = [
  'about', 'terms', 'privacy', 'responsible-gambling', 'faq', 'contact', 'cookies',
];

export interface StaticPage {
  slug: StaticPageSlug;
  title: string;
  body: string;
  meta_description?: string;
  updated_at: Date | string;
}

const DEFAULT_PAGES: Record<StaticPageSlug, StaticPage> = {
  about: {
    slug: 'about',
    title: 'About Betcheza',
    body: '<p>Betcheza is your trusted sports betting tips community. Get expert predictions, track your performance, and compete with other tipsters.</p>',
    updated_at: new Date(),
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    body: '<p>By using Betcheza, you agree to these terms of service.</p>',
    updated_at: new Date(),
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    body: '<p>We take your privacy seriously. This policy describes how we collect and use your data.</p>',
    updated_at: new Date(),
  },
  'responsible-gambling': {
    slug: 'responsible-gambling',
    title: 'Responsible Gambling',
    body: '<p>Gambling should be fun. Please gamble responsibly and within your means.</p>',
    updated_at: new Date(),
  },
  faq: {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    body: '<p>Find answers to common questions about Betcheza.</p>',
    updated_at: new Date(),
  },
  contact: {
    slug: 'contact',
    title: 'Contact Us',
    body: '<p>Get in touch with the Betcheza team.</p>',
    updated_at: new Date(),
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    body: '<p>Learn about how we use cookies on Betcheza.</p>',
    updated_at: new Date(),
  },
};

let tableReady = false;
const memory: Record<string, StaticPage> = {};

async function ensureTable(): Promise<void> {
  if (tableReady || !getPool()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS static_pages (
        slug VARCHAR(100) NOT NULL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        meta_description TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableReady = true;
  } catch {}
}

export async function getStaticPage(slug: StaticPageSlug): Promise<StaticPage> {
  await ensureTable();
  if (memory[slug]) return memory[slug];
  if (getPool()) {
    try {
      const r = await query<{ slug: string; title: string; body: string; meta_description: string | null; updated_at: string }>(
        `SELECT slug, title, body, meta_description, updated_at FROM static_pages WHERE slug = ? LIMIT 1`,
        [slug],
      );
      if (r.rows[0]) {
        const page: StaticPage = {
          slug: r.rows[0].slug as StaticPageSlug,
          title: r.rows[0].title,
          body: r.rows[0].body,
          meta_description: r.rows[0].meta_description ?? undefined,
          updated_at: r.rows[0].updated_at,
        };
        memory[slug] = page;
        return page;
      }
    } catch (e) {
      console.error('[static-pages] getStaticPage db error', e);
    }
  }
  return DEFAULT_PAGES[slug] ?? { slug, title: slug, body: '', updated_at: new Date() };
}

export async function listStaticPages(): Promise<StaticPage[]> {
  await ensureTable();
  const out: Record<string, StaticPage> = { ...DEFAULT_PAGES };
  if (getPool()) {
    try {
      const r = await query<{ slug: string; title: string; body: string; meta_description: string | null; updated_at: string }>(
        `SELECT slug, title, body, meta_description, updated_at FROM static_pages`,
      );
      for (const row of r.rows) {
        out[row.slug] = {
          slug: row.slug as StaticPageSlug,
          title: row.title,
          body: row.body,
          meta_description: row.meta_description ?? undefined,
          updated_at: row.updated_at,
        };
      }
    } catch (e) {
      console.error('[static-pages] listStaticPages db error', e);
    }
  }
  return STATIC_PAGE_SLUGS.map((s) => out[s]).filter(Boolean) as StaticPage[];
}

export async function saveStaticPage(p: StaticPage): Promise<StaticPage> {
  await ensureTable();
  memory[p.slug] = { ...p, updated_at: new Date() };
  const pool = getPool();
  if (pool) {
    try {
      await execute(
        `INSERT INTO static_pages (slug, title, body, meta_description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, meta_description = EXCLUDED.meta_description`,
        [p.slug, p.title, p.body, p.meta_description ?? null],
      );
    } catch (e) {
      console.error('[static-pages] saveStaticPage db error', e);
    }
  }
  return memory[p.slug];
}
