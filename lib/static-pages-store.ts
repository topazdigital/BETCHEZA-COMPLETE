import { query, execute, getPool } from './db';

export type StaticPageSlug = 'about' | 'terms' | 'privacy' | 'responsible-gambling' | 'faq' | 'contact' | 'cookies' | 'help';

export const STATIC_PAGE_SLUGS: StaticPageSlug[] = [
  'about', 'terms', 'privacy', 'responsible-gambling', 'faq', 'contact', 'cookies', 'help',
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
    meta_description: 'Learn about Betcheza — the trusted sports betting tips community powering smarter picks and a thriving tipster ecosystem.',
    body: `
<h2>Who We Are</h2>
<p>Betcheza is East Africa's leading sports betting tips and tipster community. Founded by bettors, for bettors, we exist to replace guesswork with data, community wisdom, and honest performance tracking. Whether you follow football in the KPL, the EPL, La Liga or beyond, Betcheza gives you the tools and community to bet smarter.</p>

<h2>What We Do</h2>
<ul>
  <li><strong>Expert Tips & Predictions</strong> — Hundreds of verified tipsters post daily picks across football, basketball, tennis, rugby, and more. Every prediction is logged, tracked, and audited so you always know who's actually performing.</li>
  <li><strong>Live Odds & Markets</strong> — Real-time odds from top bookmakers including SportPesa, Betika, 1xBet, Bet365, and more, displayed in your preferred format (Decimal, Fractional, or American).</li>
  <li><strong>AI-Powered Predictions</strong> — Our AI copilot analyses form, head-to-head records, xG data, referee trends, and injury news to generate match predictions and suggested picks in seconds.</li>
  <li><strong>Tipster Leaderboards</strong> — A transparent, stats-driven ranking of all tipsters sorted by win rate, ROI, and streak. No fake stats — every record is verifiable.</li>
  <li><strong>Jackpot Coverage</strong> — We track midweek and weekend jackpots from SportPesa, Betika, and other Kenyan bookmakers, with AI-generated picks for each game.</li>
  <li><strong>Community Feed</strong> — Post tips, debate predictions, like and comment on other tipsters' picks in a vibrant social environment built around sports betting.</li>
  <li><strong>Tipster Challenges</strong> — Head-to-head prediction battles between tipsters where the community votes and watches live scores unfold.</li>
</ul>

<h2>Our Mission</h2>
<p>We believe informed bettors are better bettors. Our mission is to democratise access to high-quality sports intelligence — the kind of analysis previously available only to professional traders and sharp bettors. We do this through transparent data, a merit-based community, and cutting-edge AI tools.</p>

<h2>Our Values</h2>
<ul>
  <li><strong>Transparency</strong> — Every tip is recorded. Every result is public. No cherry-picking, no hidden losses.</li>
  <li><strong>Responsibility</strong> — We promote responsible gambling practices and provide tools to help you stay in control.</li>
  <li><strong>Community</strong> — Betcheza is built on shared knowledge. The more you contribute, the stronger the community becomes.</li>
  <li><strong>Innovation</strong> — We continuously invest in better data, smarter AI, and a smoother user experience.</li>
</ul>

<h2>Why Trust Betcheza?</h2>
<p>Unlike tipster channels on WhatsApp or Telegram where past records are deleted and performance is impossible to verify, Betcheza keeps a full, immutable history of every tipster's picks. Our leaderboard rankings are earned — not bought. We have no financial incentive to misrepresent tipster performance because our reputation depends on accuracy.</p>

<h2>Get Started</h2>
<p>Create a free account to follow your favourite tipsters, bookmark matches, set push notifications, and track your own picks. Pro tipsters can monetise their predictions through subscriptions. Join thousands of bettors who are already using Betcheza to sharpen their edge.</p>
    `.trim(),
    updated_at: new Date(),
  },

  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    meta_description: 'Read the Betcheza Terms of Service covering use of the platform, tipster accounts, points, wagering, and prohibited conduct.',
    body: `
<p><em>Last updated: May 2026</em></p>

<h2>1. Acceptance of Terms</h2>
<p>By accessing or using Betcheza ("the Platform", "we", "us"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, do not use the Platform. We reserve the right to update these Terms at any time; continued use of the Platform after changes constitutes acceptance.</p>

<h2>2. Eligibility</h2>
<p>You must be at least 18 years of age (or the legal gambling age in your jurisdiction, whichever is higher) to register an account. By registering, you confirm that you meet this requirement and that the information you provide is accurate. Betcheza reserves the right to request proof of age at any time and to suspend accounts where eligibility cannot be confirmed.</p>

<h2>3. Account Registration</h2>
<ul>
  <li>Each user may hold only one account. Multiple accounts are prohibited and may result in permanent suspension of all accounts.</li>
  <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
  <li>You must notify us immediately of any unauthorised use of your account.</li>
  <li>Account names, avatars, and profile content must comply with our community guidelines — no impersonation, hate speech, or explicit material.</li>
</ul>

<h2>4. Tips, Predictions and Points</h2>
<p>Betcheza provides a platform for tipsters to share predictions. Tips and predictions posted on the Platform are for informational and entertainment purposes only. They do not constitute financial advice. We do not guarantee the accuracy or profitability of any tip.</p>
<p>The Betcheza points system ("BZ Points") is a virtual loyalty currency. Points have no monetary value and cannot be redeemed for cash unless explicitly stated in a specific competition or prize promotion. Points may be awarded, deducted, or forfeited at our sole discretion.</p>

<h2>5. Tipster Accounts and Subscriptions</h2>
<p>Verified Pro Tipsters may offer paid subscription tiers to their followers. Subscription fees are processed through our payment partners. Refunds for subscriptions are handled on a case-by-case basis. Betcheza takes a platform commission from all subscription revenue as disclosed at sign-up.</p>

<h2>6. Prohibited Conduct</h2>
<p>You must not:</p>
<ul>
  <li>Post false, misleading, or plagiarised predictions</li>
  <li>Manipulate the leaderboard or tip-tracking system</li>
  <li>Engage in collusion with other tipsters to artificially inflate performance metrics</li>
  <li>Use automated scripts or bots to post tips or interact with the Platform</li>
  <li>Harass, threaten, or abuse other users</li>
  <li>Post content that promotes illegal activity</li>
  <li>Attempt to reverse-engineer, hack, or disrupt the Platform</li>
</ul>

<h2>7. Intellectual Property</h2>
<p>All content on the Platform — including the site design, logo, software, and original written content — is owned by or licensed to Betcheza. You retain ownership of your tips and posts but grant Betcheza a worldwide, royalty-free licence to display, reproduce, and distribute that content on the Platform.</p>

<h2>8. Limitation of Liability</h2>
<p>Betcheza is not liable for any financial losses arising from betting decisions made based on information or predictions found on this Platform. Sports betting involves risk; always gamble within your means. Our total liability to you for any claim arising under these Terms shall not exceed the amount you paid to us in the 30 days preceding the claim.</p>

<h2>9. Termination</h2>
<p>We reserve the right to suspend or permanently terminate any account that violates these Terms, without notice and without liability. Users may close their account at any time by contacting support.</p>

<h2>10. Governing Law</h2>
<p>These Terms are governed by the laws of Kenya. Any disputes shall be subject to the exclusive jurisdiction of the courts of Nairobi, Kenya.</p>

<h2>11. Contact</h2>
<p>For questions about these Terms, contact us at <a href="mailto:legal@betcheza.co.ke">legal@betcheza.co.ke</a>.</p>
    `.trim(),
    updated_at: new Date(),
  },

  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    meta_description: 'Understand how Betcheza collects, uses, and protects your personal data in accordance with applicable privacy laws.',
    body: `
<p><em>Last updated: May 2026</em></p>

<h2>1. Introduction</h2>
<p>Betcheza ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains what personal data we collect, how we use it, and your rights regarding that data. By using the Platform, you agree to the collection and use of information in accordance with this Policy.</p>

<h2>2. Data We Collect</h2>
<h3>Information you provide directly:</h3>
<ul>
  <li><strong>Account data</strong> — name, email address, phone number, country, password (hashed)</li>
  <li><strong>Profile data</strong> — username, display name, bio, avatar, tipster specialties</li>
  <li><strong>Payment data</strong> — billing information processed via our payment partners (we do not store raw card numbers)</li>
  <li><strong>Communications</strong> — messages sent to support, community posts, comments</li>
</ul>
<h3>Information collected automatically:</h3>
<ul>
  <li><strong>Usage data</strong> — pages visited, features used, session duration, referral source</li>
  <li><strong>Device data</strong> — IP address, browser type, operating system, device identifiers</li>
  <li><strong>Cookies</strong> — see our Cookie Policy for details</li>
</ul>

<h2>3. How We Use Your Data</h2>
<ul>
  <li>To create and manage your account</li>
  <li>To deliver the Platform's features (tips, leaderboards, notifications, AI predictions)</li>
  <li>To process payments and subscriptions</li>
  <li>To send service-related communications (account verification, password resets, push notifications you opt into)</li>
  <li>To improve the Platform through analytics and A/B testing</li>
  <li>To detect and prevent fraud, abuse, and Terms violations</li>
  <li>To comply with legal obligations</li>
</ul>

<h2>4. Legal Basis for Processing (GDPR)</h2>
<p>Where GDPR applies, we process your data under the following legal bases: contract performance (to provide the service), legitimate interests (security, fraud prevention, product improvement), consent (marketing emails, push notifications), and legal obligation.</p>

<h2>5. Sharing of Data</h2>
<p>We do not sell your personal data. We share data only with:</p>
<ul>
  <li><strong>Service providers</strong> — hosting, email delivery (SMTP), payment processors, analytics (under strict data processing agreements)</li>
  <li><strong>Law enforcement</strong> — when required by law or court order</li>
  <li><strong>Business transfers</strong> — in the event of a merger or acquisition, subject to the same privacy protections</li>
</ul>
<p>Tipster usernames, display names, win rates, and public tips are visible to all registered users as part of the Platform's core functionality.</p>

<h2>6. Data Retention</h2>
<p>We retain your account data for as long as your account is active. If you close your account, we retain data for up to 90 days before deletion, except where longer retention is required by law. Tip and prediction history may be retained in anonymised form for statistical purposes.</p>

<h2>7. Your Rights</h2>
<p>You have the right to:</p>
<ul>
  <li>Access the personal data we hold about you</li>
  <li>Correct inaccurate data</li>
  <li>Request deletion of your data (right to be forgotten)</li>
  <li>Restrict or object to processing in certain circumstances</li>
  <li>Data portability (receive your data in a machine-readable format)</li>
  <li>Withdraw consent at any time (without affecting prior processing)</li>
</ul>
<p>To exercise these rights, contact <a href="mailto:privacy@betcheza.co.ke">privacy@betcheza.co.ke</a>.</p>

<h2>8. Security</h2>
<p>We implement industry-standard security measures including HTTPS/TLS encryption, bcrypt password hashing, HTTP-only JWT cookies, and regular security audits. No system is 100% secure; you use the Platform at your own risk.</p>

<h2>9. International Transfers</h2>
<p>Your data may be processed in countries outside your own. Where we transfer data internationally, we ensure appropriate safeguards are in place (e.g. standard contractual clauses).</p>

<h2>10. Changes to This Policy</h2>
<p>We may update this Policy periodically. We will notify you of significant changes via email or an in-app notification. Continued use of the Platform after changes constitutes acceptance.</p>

<h2>11. Contact Us</h2>
<p>Data Controller: Betcheza Ltd, Nairobi, Kenya. Email: <a href="mailto:privacy@betcheza.co.ke">privacy@betcheza.co.ke</a></p>
    `.trim(),
    updated_at: new Date(),
  },

  'responsible-gambling': {
    slug: 'responsible-gambling',
    title: 'Responsible Gambling',
    meta_description: 'Betcheza is committed to responsible gambling. Read our tools, resources, and guidelines for safe betting.',
    body: `
<h2>Our Commitment</h2>
<p>At Betcheza, we believe sports betting should be fun, social, and — above all — controlled. Problem gambling is a serious issue that affects millions of people. We are committed to providing tools, resources, and information to help our users gamble responsibly.</p>

<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0; border-radius: 4px;">
  <strong>⚠️ Important:</strong> If gambling is no longer fun and is causing stress, financial harm, or relationship problems, please seek help immediately. See the resources at the bottom of this page.
</div>

<h2>Signs of Problem Gambling</h2>
<p>Ask yourself honestly:</p>
<ul>
  <li>Do you bet more money than you can afford to lose?</li>
  <li>Do you chase losses by placing bigger bets?</li>
  <li>Has gambling affected your work, relationships, or mental health?</li>
  <li>Do you feel restless or irritable when not gambling?</li>
  <li>Do you hide your gambling from friends or family?</li>
  <li>Do you borrow money or sell possessions to fund gambling?</li>
</ul>
<p>If you answered "yes" to two or more of these, we strongly encourage you to seek support.</p>

<h2>Our Responsible Gambling Tools</h2>
<ul>
  <li><strong>Deposit Limits</strong> — Set daily, weekly, or monthly limits on how much you deposit into connected bookmaker accounts.</li>
  <li><strong>Session Time Reminders</strong> — We can send you reminders if you've been active on the platform for an extended period.</li>
  <li><strong>Self-Exclusion</strong> — Request a temporary or permanent exclusion from the platform by contacting support. We will process your request within 24 hours.</li>
  <li><strong>Reality Check</strong> — Track your net profit/loss against your tips on your personal dashboard.</li>
  <li><strong>Account Closure</strong> — Close your account at any time by contacting <a href="mailto:support@betcheza.co.ke">support@betcheza.co.ke</a>.</li>
</ul>

<h2>Tips for Safer Betting</h2>
<ol>
  <li><strong>Set a budget</strong> — Only bet what you can afford to lose. Treat it as entertainment spending.</li>
  <li><strong>Never chase losses</strong> — Chasing losses almost always makes things worse. Take a break after a losing run.</li>
  <li><strong>Avoid betting under the influence</strong> — Alcohol and stress impair judgment. Bet when clear-headed.</li>
  <li><strong>Keep records</strong> — Track your bets and results honestly. Denial is the enemy of control.</li>
  <li><strong>Balance it with other activities</strong> — Sports betting should be one of many hobbies, not your only one.</li>
  <li><strong>Take breaks</strong> — Regular breaks from betting help maintain perspective.</li>
  <li><strong>Don't bet on credit</strong> — Never borrow money to fund gambling. This is a red flag.</li>
</ol>

<h2>Support Resources</h2>
<ul>
  <li><strong>Kenya — Responsible Gambling Kenya:</strong> <a href="https://responsiblegamblingkenya.org" target="_blank" rel="noopener">responsiblegamblingkenya.org</a></li>
  <li><strong>International — GamCare:</strong> <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener">gamcare.org.uk</a> | Helpline: 0808 8020 133</li>
  <li><strong>International — Gamblers Anonymous:</strong> <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener">gamblersanonymous.org</a></li>
  <li><strong>International — BeGambleAware:</strong> <a href="https://www.begambleaware.org" target="_blank" rel="noopener">begambleaware.org</a></li>
</ul>

<p>You can also contact us directly at <a href="mailto:support@betcheza.co.ke">support@betcheza.co.ke</a> if you need help accessing any of our responsible gambling tools.</p>
    `.trim(),
    updated_at: new Date(),
  },

  faq: {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    meta_description: 'Find answers to the most common questions about Betcheza — accounts, tips, leaderboards, payments, and more.',
    body: `
<h2>General</h2>

<h3>What is Betcheza?</h3>
<p>Betcheza is a sports betting tipster community platform. It lets you follow expert tipsters, access AI-powered match predictions, track tip performance, compete in challenges, and stay updated with live odds and jackpot games — all in one place.</p>

<h3>Is Betcheza free to use?</h3>
<p>Yes. The core platform is completely free. You can browse tips, view leaderboards, follow tipsters, and use the AI predictions at no cost. Some Pro tipsters offer paid subscription tiers for exclusive premium tips.</p>

<h3>Does Betcheza place bets for me?</h3>
<p>No. Betcheza is a tips and prediction platform. You use the tips on your chosen bookmaker platform independently. We are not a bookmaker and do not handle any betting funds.</p>

<h2>Accounts</h2>

<h3>How do I create an account?</h3>
<p>Click "Sign Up" in the header, fill in your email, username, phone number, and password, complete the security check, and verify your email. The whole process takes under 2 minutes.</p>

<h3>Can I sign in with Google?</h3>
<p>Yes. We support Google One Tap sign-in for faster access. Your Google profile photo and name will be used automatically.</p>

<h3>I forgot my password. What do I do?</h3>
<p>Click "Forgot password?" on the sign-in screen. Enter your email and we'll send a reset link. Check your spam folder if you don't see it within a few minutes.</p>

<h3>How do I become a verified tipster?</h3>
<p>Verification is granted to tipsters with a proven track record (minimum 50 posted tips, consistent win rate above 55%, and at least 30 days on the platform). Apply through your dashboard under Settings → Tipster Profile.</p>

<h2>Tips & Predictions</h2>

<h3>How are tipster stats calculated?</h3>
<p>Win rate is calculated as won tips ÷ total settled tips × 100. ROI is (total returns − total staked) ÷ total staked × 100. All calculations are based on 1-unit flat stakes unless a tipster specifies otherwise.</p>

<h3>How do I know which tipsters to follow?</h3>
<p>Use the Leaderboard to sort by win rate, ROI, or current streak. Filter by sport and look for tipsters with at least 30+ tips to ensure statistical significance. Consistency over time matters more than short-term hot streaks.</p>

<h3>What sports are covered?</h3>
<p>Football (soccer), basketball, tennis, rugby, cricket, boxing/MMA, baseball, American football, ice hockey, volleyball, table tennis, golf, darts, snooker, motorsport, cycling, esports, and athletics.</p>

<h3>How accurate are the AI predictions?</h3>
<p>Our AI uses form data, head-to-head records, expected goals (xG), referee statistics, and news sentiment. Like any prediction model, it is not infallible. Treat AI picks as one input among many, not gospel.</p>

<h2>Jackpots</h2>

<h3>Which jackpots does Betcheza cover?</h3>
<p>We track the SportPesa Midweek Jackpot, SportPesa Mega Jackpot, Betika Grand Jackpot, Betika Midweek Jackpot, Shabiki Jackpot, and Mozzart Jackpot. Each has a dedicated page with AI predictions and community tips.</p>

<h2>Payments & Points</h2>

<h3>What are BZ Points?</h3>
<p>BZ Points are Betcheza's virtual currency. You earn them by posting tips, winning challenges, and completing achievements. Points can be used in competitions and to unlock certain features. They have no cash value unless specified in a prize promotion.</p>

<h3>How do I withdraw my wallet balance?</h3>
<p>Go to Dashboard → Wallet → Withdraw. Supported methods include M-Pesa, bank transfer, and Airtel Money. Minimum withdrawal is KES 100. Processing takes 1–3 business days.</p>

<h2>Technical</h2>

<h3>Which browsers are supported?</h3>
<p>Betcheza works best on Chrome, Firefox, Edge, and Safari (latest versions). We recommend enabling JavaScript and allowing cookies for the full experience.</p>

<h3>Is there a mobile app?</h3>
<p>Betcheza is a progressive web app (PWA) optimised for mobile browsers. You can add it to your home screen from your browser menu for an app-like experience. A dedicated mobile app is on the roadmap.</p>

<h3>How do I enable push notifications?</h3>
<p>Go to Settings → Notifications and toggle on the alert types you want. Your browser will ask for permission. Make sure browser notifications are enabled in your device settings.</p>

<h3>I found a bug. How do I report it?</h3>
<p>Email <a href="mailto:bugs@betcheza.co.ke">bugs@betcheza.co.ke</a> with a description of the issue, your browser/device, and screenshots if possible. We investigate all reports promptly.</p>
    `.trim(),
    updated_at: new Date(),
  },

  contact: {
    slug: 'contact',
    title: 'Contact Us',
    meta_description: 'Get in touch with the Betcheza team for support, partnerships, press enquiries, or responsible gambling assistance.',
    body: `
<h2>We'd Love to Hear From You</h2>
<p>Whether you have a question about your account, a partnership proposal, a media enquiry, or need help with a responsible gambling concern — our team is here to help.</p>

<h2>General Support</h2>
<p>For account issues, tips disputes, billing questions, or general help:</p>
<ul>
  <li>📧 Email: <a href="mailto:support@betcheza.co.ke">support@betcheza.co.ke</a></li>
  <li>⏱ Response time: Within 24 hours on business days</li>
</ul>

<h2>Responsible Gambling</h2>
<p>If you need to self-exclude, set betting limits, or get help with a gambling problem, we treat these requests with the highest priority:</p>
<ul>
  <li>📧 Email: <a href="mailto:support@betcheza.co.ke">support@betcheza.co.ke</a> — Subject: "Responsible Gambling"</li>
  <li>⏱ Response time: Within 2 hours</li>
</ul>

<h2>Partnerships & Affiliates</h2>
<p>Interested in partnering with Betcheza, sponsoring content, or joining our affiliate programme?</p>
<ul>
  <li>📧 Email: <a href="mailto:partnerships@betcheza.co.ke">partnerships@betcheza.co.ke</a></li>
</ul>

<h2>Press & Media</h2>
<p>For media enquiries, interview requests, and press releases:</p>
<ul>
  <li>📧 Email: <a href="mailto:press@betcheza.co.ke">press@betcheza.co.ke</a></li>
</ul>

<h2>Legal & Privacy</h2>
<p>For data access requests, GDPR enquiries, or legal notices:</p>
<ul>
  <li>📧 Email: <a href="mailto:legal@betcheza.co.ke">legal@betcheza.co.ke</a></li>
</ul>

<h2>Bug Reports</h2>
<p>Found a technical issue or security vulnerability?</p>
<ul>
  <li>📧 Email: <a href="mailto:bugs@betcheza.co.ke">bugs@betcheza.co.ke</a></li>
  <li>Please include your browser, device, and steps to reproduce the issue.</li>
</ul>

<h2>Our Location</h2>
<p>Betcheza is headquartered in Nairobi, Kenya. We operate across East and West Africa and have users in over 50 countries worldwide.</p>

<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 24px 0; border-radius: 4px;">
  <strong>Tipster Verification:</strong> If you're applying for Pro Tipster verification, do so directly from your Dashboard → Settings. You do not need to email us for this.
</div>
    `.trim(),
    updated_at: new Date(),
  },

  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    meta_description: 'Learn how Betcheza uses cookies and similar technologies to enhance your experience and analyse platform usage.',
    body: `
<p><em>Last updated: May 2026</em></p>

<h2>What Are Cookies?</h2>
<p>Cookies are small text files placed on your device by a website when you visit it. They help the website remember your preferences and activity, making your experience smoother and more personalised. Similar technologies include local storage, session storage, and pixels.</p>

<h2>How We Use Cookies</h2>
<p>Betcheza uses cookies for the following purposes:</p>

<h3>1. Essential Cookies (Always Active)</h3>
<p>These cookies are necessary for the Platform to function and cannot be disabled.</p>
<table style="width:100%; border-collapse: collapse; font-size: 0.875rem;">
  <thead>
    <tr style="background: #f3f4f6;">
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Cookie</th>
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Purpose</th>
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Duration</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>bz_token</code></td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Authenticates your session (HTTP-only, secure JWT)</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">7 days (30 days if "Remember Me")</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>bz_prefs</code></td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Stores your odds format and timezone preferences</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">1 year</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>betcheza_settings</code></td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Persists theme (dark/light) and notification settings</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">1 year</td>
    </tr>
  </tbody>
</table>

<h3>2. Functional Cookies (Opt-in)</h3>
<p>These cookies enhance functionality and personalisation but are not strictly necessary.</p>
<table style="width:100%; border-collapse: collapse; font-size: 0.875rem;">
  <thead>
    <tr style="background: #f3f4f6;">
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Cookie</th>
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Purpose</th>
      <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Duration</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>bz_sidebar</code></td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Remembers sidebar league grouping and filter state</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Session</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>bz_season</code></td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Remembers your selected season for statistics</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">Session</td>
    </tr>
  </tbody>
</table>

<h3>3. Analytics Cookies (Opt-in)</h3>
<p>We may use analytics tools to understand how users interact with the Platform. These are anonymised and aggregated. We do not currently use third-party advertising trackers. If this changes, we will update this policy and re-request consent.</p>

<h2>Third-Party Cookies</h2>
<p>Some features embed third-party content (e.g., match score widgets). These providers may set their own cookies. We have no control over third-party cookies. Please review the privacy policies of those providers.</p>

<h2>Managing Cookies</h2>
<p>You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. Note that blocking essential cookies will prevent you from logging in and using core Platform features.</p>
<ul>
  <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome cookie settings</a></li>
  <li><a href="https://support.mozilla.org/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener">Firefox cookie settings</a></li>
  <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/" target="_blank" rel="noopener">Safari cookie settings</a></li>
</ul>

<h2>Changes to This Policy</h2>
<p>We may update this Cookie Policy from time to time. Significant changes will be communicated via a notification banner on the Platform.</p>

<h2>Contact</h2>
<p>For questions about our use of cookies: <a href="mailto:privacy@betcheza.co.ke">privacy@betcheza.co.ke</a></p>
    `.trim(),
    updated_at: new Date(),
  },

  help: {
    slug: 'help',
    title: 'Help Centre',
    meta_description: 'Find answers to common questions about Betcheza — accounts, tips, leaderboards, wallet, notifications, and more.',
    body: `
<h2>Welcome to the Betcheza Help Centre</h2>
<p>Find answers to the most common questions below. If you can't find what you need, use the <a href="/contact">Contact Us</a> page to reach our support team.</p>

<h2>Getting Started</h2>
<h3>How do I create an account?</h3>
<p>Click the <strong>Sign Up</strong> button at the top of any page and fill in your name, email, and a secure password. You'll receive a 6-digit verification code by email — enter it to activate your account and unlock all features.</p>

<h3>Do I need to verify my email?</h3>
<p>Yes. Email verification is required to post tips, follow tipsters, and participate in competitions. Check your inbox (and your spam/junk folder) for the code. If it doesn't arrive, click <strong>Resend code</strong> in the verification panel.</p>

<h3>How do I sign in with Google?</h3>
<p>Click the Google icon on the login or register screen. Your account is automatically created and verified — no separate email code required.</p>

<h2>Tips & Predictions</h2>
<h3>How do I post a tip?</h3>
<p>Navigate to a match page, open the <strong>Tips</strong> tab, and click <strong>Add Tip</strong>. Select your market, prediction, odds, stake, and confidence level, then submit. Your tip is immediately visible on the community feed.</p>

<h3>What does confidence level mean?</h3>
<p>Confidence (50–95%) is your self-assessed certainty about the pick. It appears on your tip card and factors into your tipster ranking score. Be honest — over-stated confidence hurts your ROI metrics.</p>

<h3>Can I edit or delete a tip after posting?</h3>
<p>Tips cannot be edited after they are posted — this is deliberate to ensure the integrity of the prediction record. You can delete a tip before the match kicks off, but deleted tips are removed from your stats.</p>

<h3>What is a Premium tip?</h3>
<p>Pro Tipsters can mark tips as Premium. Premium tips are visible only to followers with an active subscription. The lock icon indicates a premium-only pick.</p>

<h2>Leaderboard & Rankings</h2>
<h3>How is the leaderboard calculated?</h3>
<p>Tipsters are ranked by a composite score that weighs win rate, ROI (return on investment), total tips posted, and recent form (last 30 days). Only settled tips with verified results count.</p>

<h3>How do I become a Pro Tipster?</h3>
<p>Visit the <a href="/become-tipster">Become a Tipster</a> page and apply. We review your existing tip history and performance stats. Approved Pro Tipsters get a verified badge and can accept subscriptions.</p>

<h2>AI Predictions</h2>
<h3>How does the AI copilot work?</h3>
<p>Our AI analyses live match data, team form, head-to-head records, injury news, and market odds to generate match predictions. You can ask it anything using the chat button (bottom right on match pages).</p>

<h3>Are AI predictions guaranteed to win?</h3>
<p>No prediction — human or AI — is guaranteed. AI tips are a research tool, not financial advice. Always gamble responsibly and within your means.</p>

<h2>Wallet & Payments</h2>
<h3>How do I deposit funds?</h3>
<p>Go to <strong>Dashboard → Wallet</strong> and click <strong>Deposit</strong>. We support M-Pesa, bank transfer, and card payments. Minimum deposit is KES 100.</p>

<h3>How long do withdrawals take?</h3>
<p>M-Pesa withdrawals are usually processed within 5 minutes. Bank transfers take 1–3 business days. Large withdrawals may require additional verification.</p>

<h3>What is the referral bonus?</h3>
<p>Invite a friend using your unique referral link from <strong>Dashboard → Referrals</strong>. When they sign up and verify their email, you earn <strong>KES 100</strong> and they receive a <strong>KES 50</strong> welcome bonus automatically.</p>

<h2>Notifications</h2>
<h3>How do I enable push notifications?</h3>
<p>Click the <strong>Notification Bell</strong> in the header and allow notifications when prompted by your browser. You can customise which alerts you receive in <strong>Settings → Notifications</strong>.</p>

<h3>Why am I not receiving email notifications?</h3>
<p>Check your spam/junk folder and add <strong>noreply@betcheza.co.ke</strong> to your contacts. If the problem persists, verify that your email address is confirmed and that notifications are enabled in Settings.</p>

<h2>Account & Security</h2>
<h3>How do I change my password?</h3>
<p>Go to <strong>Settings → Security</strong> and use the Change Password form. You'll need to enter your current password first.</p>

<h3>How do I enable two-factor authentication (2FA)?</h3>
<p>In <strong>Settings → Security</strong>, toggle on Two-Factor Authentication. A code will be sent to your email each time you log in from a new device.</p>

<h3>How do I delete my account?</h3>
<p>Contact our support team via the <a href="/contact">Contact</a> page requesting account deletion. We will process the request within 7 days and send a confirmation email.</p>

<h2>Still need help?</h2>
<p>Our support team is available Monday–Friday, 8 AM–8 PM EAT. Reach us via the <a href="/contact">Contact Us</a> page or email <a href="mailto:support@betcheza.co.ke">support@betcheza.co.ke</a>.</p>
    `.trim(),
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
         ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), meta_description = VALUES(meta_description)`,
        [p.slug, p.title, p.body, p.meta_description ?? null],
      );
    } catch (e) {
      console.error('[static-pages] saveStaticPage db error', e);
    }
  }
  return memory[p.slug];
}
