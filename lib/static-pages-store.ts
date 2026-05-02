import { execute, query, getPool } from './db';

export interface StaticPage {
  slug: string;
  title: string;
  body: string;
  meta_description?: string;
  updated_at?: Date;
}

export const STATIC_PAGE_SLUGS = [
  'help',
  'faq',
  'contact',
  'responsible-gambling',
  'terms',
  'privacy',
  'cookies',
  'about',
] as const;

export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

const DEFAULT_PAGES: Record<string, StaticPage> = {
  help: {
    slug: 'help',
    title: 'Help Center',
    meta_description: 'Get help using Betcheza — accounts, tips, payouts, notifications, and more.',
    body: `Welcome to the Betcheza Help Center.

Need a hand? Here are the most common things we get asked.

Account & Sign-in
- Forgot password? Use "Forgot password" on the sign-in screen — a reset link will be emailed to you.
- Two-factor authentication can be enabled in your account page.

Posting Tips
- Tipsters can post a tip from any match page using the "Add Tip" button.
- Each tip needs a market, selection, odds and a short analysis.

Following Tipsters
- Visit any tipster profile and tap Follow to see their tips on your dashboard.

Still stuck? Email us via the Contact page and we'll get back to you within 24 hours.`,
  },
  faq: {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    meta_description: 'Answers to the most common questions about using Betcheza.',
    body: `Frequently Asked Questions

Is Betcheza free?
Yes — browsing matches, viewing tips and reading our analysis is completely free.

Are the AI predictions guaranteed?
No prediction is guaranteed. AI picks combine real data (form, odds, head-to-head) but variance is part of betting. Always stake responsibly.

How are tipsters ranked?
Tipsters are ranked by ROI, win rate and consistency on settled tips. The leaderboard updates daily.

Can I become a tipster?
Yes. Sign up, post your first 10 tips, and your profile will be considered for verification.

How do I withdraw earnings?
Once your earnings clear the minimum threshold, you can withdraw via the payment methods configured for your country in your account settings.`,
  },
  contact: {
    slug: 'contact',
    title: 'Contact Us',
    meta_description: 'Get in touch with the Betcheza team for support, partnerships, or press enquiries.',
    body: `We'd love to hear from you.

Support: support@betcheza.co.ke
Partnerships: partners@betcheza.co.ke
Press: press@betcheza.co.ke

We typically reply within 24 hours, Monday to Friday.

You can also reach us through our social channels — see the icons in the footer.`,
  },
  'responsible-gambling': {
    slug: 'responsible-gambling',
    title: 'Responsible Gambling',
    meta_description: 'Bet responsibly. Tools and resources to help you stay in control.',
    body: `Bet smart. Bet small. Walk away when it stops being fun.

Stay in control
- Set a daily and monthly deposit limit you can afford to lose.
- Never chase losses. A losing run doesn't owe you a comeback.
- Take regular breaks — at least one full day off per week.
- Don't bet under emotional or financial stress.

Warning signs
- Spending more than you planned, more often than you planned.
- Borrowing money to bet.
- Hiding bets from family or friends.
- Feeling restless or irritable when not betting.

Help is available
- UK: GamCare 0808 8020 133 — gamcare.org.uk
- US: 1-800-GAMBLER — ncpgambling.org
- International: BeGambleAware.org

If you need to take a break, contact our support team and we can lock your account for any cooling-off period you choose.`,
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    meta_description: 'The terms and conditions that govern your use of Betcheza.',
    body: `These Terms of Service govern your use of Betcheza ("the Service"). By creating an account or using the Service you agree to these terms.

1. Eligibility
You must be 18 years or older to use Betcheza. The Service is provided for entertainment and informational purposes only.

2. Account
You are responsible for keeping your password and account secure. Notify us immediately of any unauthorised access.

3. Tips & Predictions
All tips, predictions and analysis on Betcheza are opinions, not financial advice. We do not guarantee any outcome. You bet at your own risk.

4. Conduct
Don't post abusive, fraudulent, or illegal content. We reserve the right to suspend accounts that violate these rules.

5. Termination
We may suspend or close any account that breaches these terms or applicable law.

6. Liability
To the maximum extent permitted by law, Betcheza is not liable for any losses arising from your use of the Service.

7. Changes
We may update these terms from time to time. Continued use of the Service constitutes acceptance.

For questions about these terms, contact us via the Contact page.`,
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    meta_description: 'How Betcheza collects, uses, and protects your personal data.',
    body: `Your privacy matters. This policy explains what we collect and how we use it.

What we collect
- Account info: email, username, country, and password (hashed).
- Activity: tips you post, follows, comments, and settings.
- Technical: IP address, browser type, and approximate location for analytics.

How we use it
- To run your account and personalise your experience.
- To send the notifications you opted into.
- To improve the Service and detect abuse.

Sharing
We don't sell your data. We share only with the providers needed to run the Service (hosting, email, analytics).

Your rights
You can request a copy of your data, ask us to correct it, or delete your account at any time. Email privacy@betcheza.co.ke.

Cookies
See our Cookie Policy for details on the cookies we use.

Contact
For privacy questions, email privacy@betcheza.co.ke.`,
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    meta_description: 'How and why Betcheza uses cookies and similar technologies.',
    body: `What are cookies?
Cookies are small text files stored on your device that help websites work and remember your preferences.

Cookies we use
- Essential: keep you signed in and remember your settings.
- Analytics: help us understand how the site is used so we can improve it.
- Preferences: remember things like odds format, theme, and language.

Managing cookies
You can clear or block cookies in your browser settings, but parts of the site (sign-in, settings) may stop working properly.

Third parties
We use lightweight, privacy-respecting analytics. No advertising cookies are set without your consent.`,
  },
  about: {
    slug: 'about',
    title: 'About Betcheza',
    meta_description: 'About Betcheza — the smart sports betting tipster community.',
    body: `Betcheza is a sports betting tipster community built for fans who want sharper picks, real data, and a community of people who care about the long game.

What makes us different
- Real-time data from ESPN and other public feeds — not stale fixtures.
- AI predictions grounded in form, head-to-head and live odds.
- A leaderboard that ranks tipsters by ROI and consistency, not noise.
- Support across 35+ sports and 200+ leagues.

We're built and run by a small team that loves football, basketball, MMA, tennis and the long-term math behind a smart bet.`,
  },
};

const g = globalThis as { __memoryStaticPages?: Record<string, StaticPage> };
const memory: Record<string, StaticPage> =
  g.__memoryStaticPages ?? (g.__memoryStaticPages = { ...DEFAULT_PAGES });

let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  const pool = getPool();
  if (!pool) {
    tableEnsured = true;
    return;
  }
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS static_pages (
        slug VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        meta_description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableEnsured = true;
  } catch (e) {
    console.error('[static-pages] ensureTable failed', e);
  }
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  await ensureTable();
  const pool = getPool();
  if (pool) {
    try {
      const r = await query<{ slug: string; title: string; body: string; meta_description: string | null; updated_at: Date }>(
        'SELECT slug, title, body, meta_description, updated_at FROM static_pages WHERE slug = ?',
        [slug],
      );
      if (r.rows.length) {
        const row = r.rows[0];
        return {
          slug: row.slug,
          title: row.title,
          body: row.body,
          meta_description: row.meta_description ?? undefined,
          updated_at: row.updated_at,
        };
      }
    } catch (e) {
      console.error('[static-pages] getStaticPage db error', e);
    }
  }
  return memory[slug] || DEFAULT_PAGES[slug] || null;
}

export async function listStaticPages(): Promise<StaticPage[]> {
  await ensureTable();
  const pool = getPool();
  const out: Record<string, StaticPage> = { ...DEFAULT_PAGES, ...memory };
  if (pool) {
    try {
      const r = await query<{ slug: string; title: string; body: string; meta_description: string | null; updated_at: Date }>(
        'SELECT slug, title, body, meta_description, updated_at FROM static_pages',
      );
      for (const row of r.rows) {
        out[row.slug] = {
          slug: row.slug,
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
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, meta_description = EXCLUDED.meta_description`,
        [p.slug, p.title, p.body, p.meta_description ?? null],
      );
    } catch (e) {
      console.error('[static-pages] saveStaticPage db error', e);
    }
  }
  return memory[p.slug];
}
