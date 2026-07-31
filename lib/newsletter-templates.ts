/**
 * Ready-made newsletter templates for the admin "Email Active Subscribers"
 * composer (app/admin/subscribers/page.tsx). Distinct from lib/email-templates.ts,
 * which holds transactional/branded HTML emails (strategy picks, tipster
 * subscriptions, broadcasts, etc.) used by the backend mailer.
 *
 * Each template's subject/body may use the same {{name}} / {{email}} /
 * {{siteUrl}} placeholders that /api/admin/subscribers/email already renders
 * via lib/mailer's renderTemplate().
 *
 * Purely a content library — admins pick one, tweak the text, then send.
 * Nothing here talks to email providers or triggers sends by itself.
 */

export interface NewsletterTemplate {
  id: string;
  label: string;
  category: 'Engagement' | 'Product' | 'Promo' | 'Results' | 'Lifecycle';
  subject: string;
  body: string;
}

export const NEWSLETTER_TEMPLATES: NewsletterTemplate[] = [
  {
    id: 'welcome',
    label: 'Welcome — new subscriber',
    category: 'Lifecycle',
    subject: "Welcome to Betcheza, {{name}}! 🎉",
    body: `Hi {{name}},

Thanks for joining Betcheza — Kenya's home for AI-powered predictions, expert tipster picks, and daily betting strategy.

Here's what you get as a subscriber:
- Daily free tips across 35+ sports
- AI match predictions before kickoff
- Our 3 Daily Odds Strategy, tracked transparently every week
- Big jackpot picks for SportPesa & Betika

Get started: {{siteUrl}}

See you on the leaderboard,
The Betcheza Team`,
  },
  {
    id: 'daily-tips-digest',
    label: 'Daily tips digest',
    category: 'Engagement',
    subject: "Today's top betting tips are live 🔥",
    body: `Hi {{name}},

Today's free tips are up — picked by our top tipsters and cross-checked with AI predictions.

👉 See today's tips: {{siteUrl}}/tips

New here? Check the AI Predictor for live confidence scores on any match: {{siteUrl}}/ai-predictor

Bet responsibly,
The Betcheza Team`,
  },
  {
    id: 'strategy-weekly-recap',
    label: 'Weekly strategy performance recap',
    category: 'Results',
    subject: 'Your weekly strategy recap is in',
    body: `Hi {{name}},

Here's how the 3 Daily Odds Strategy performed this week:

- Days won: [FILL IN]
- Days lost: [FILL IN]
- Weekly profit: KES [FILL IN]

Every result is tracked transparently on the strategy page — nothing hidden, wins and losses both shown.

See the full breakdown: {{siteUrl}}/strategy

The Betcheza Team`,
  },
  {
    id: 'jackpot-alert',
    label: 'Jackpot picks alert',
    category: 'Engagement',
    subject: "This week's jackpot picks are ready 💰",
    body: `Hi {{name}},

This week's SportPesa & Betika jackpot picks are ready, with reasoning for every fixture.

👉 Get the picks: {{siteUrl}}/jackpots

Good luck,
The Betcheza Team`,
  },
  {
    id: 'winning-streak',
    label: 'Tipster winning-streak highlight',
    category: 'Engagement',
    subject: 'Our top tipsters are on fire right now 🔥',
    body: `Hi {{name}},

A few of our tipsters are on serious winning streaks this week. Follow them to get notified the moment they post a new pick.

👉 See the leaderboard: {{siteUrl}}/leaderboard
👉 Browse tipsters: {{siteUrl}}/tipsters

The Betcheza Team`,
  },
  {
    id: 'challenges-invite',
    label: 'Tipster Challenges invite',
    category: 'Product',
    subject: 'Think you can out-predict our tipsters? Prove it 🏆',
    body: `Hi {{name}},

Tipster Challenges is live — pick a match, back your predictions against another tipster, and win the prize pot if you score higher.

👉 Join a challenge: {{siteUrl}}/challenges

The Betcheza Team`,
  },
  {
    id: 'reengagement',
    label: 'We miss you — re-engagement',
    category: 'Lifecycle',
    subject: "We've missed you, {{name}}",
    body: `Hi {{name}},

It's been a while! Since your last visit we've added:
- More sports coverage (35+ and counting)
- A smarter AI Predictor
- Tipster Challenges — pick-for-pick battles with real prize pots

Come see what's new: {{siteUrl}}

The Betcheza Team`,
  },
  {
    id: 'competition-announcement',
    label: 'Competition / tournament announcement',
    category: 'Product',
    subject: 'New competition just opened — join now',
    body: `Hi {{name}},

A new prediction competition just opened on Betcheza. Compete against other bettors, climb the leaderboard, and win real prizes.

👉 See competitions: {{siteUrl}}/competitions

The Betcheza Team`,
  },
  {
    id: 'become-a-tipster',
    label: 'Become a tipster — recruitment',
    category: 'Product',
    subject: 'Good at picking winners? Become a Betcheza tipster',
    body: `Hi {{name}},

If you consistently call matches right, you could be earning from it. Betcheza tipsters build a following, get featured on the leaderboard, and can monetize their picks.

👉 Apply here: {{siteUrl}}/become-a-tipster

The Betcheza Team`,
  },
  {
    id: 'app-install',
    label: 'Install the app / enable notifications',
    category: 'Product',
    subject: 'Never miss a tip — get instant alerts',
    body: `Hi {{name}},

Enable notifications (or install the Betcheza app) to get instant alerts for goals, new tips, and jackpot picks — even when the site is closed.

👉 Turn on notifications: {{siteUrl}}

The Betcheza Team`,
  },
  {
    id: 'big-match-preview',
    label: 'Big match preview',
    category: 'Engagement',
    subject: "Big match today — here's our read on it",
    body: `Hi {{name}},

[TEAM A] vs [TEAM B] kicks off today, and our AI + tipsters have a prediction ready.

👉 See the full breakdown: {{siteUrl}}/matches/[SLUG]

The Betcheza Team`,
  },
  {
    id: 'promo-generic',
    label: 'Generic promo / partner offer',
    category: 'Promo',
    subject: 'A special offer for Betcheza subscribers',
    body: `Hi {{name}},

[PARTNER/OFFER DETAILS HERE]

👉 [CTA LINK]

The Betcheza Team`,
  },
];

export function getNewsletterTemplate(id: string): NewsletterTemplate | undefined {
  return NEWSLETTER_TEMPLATES.find((t) => t.id === id);
}
