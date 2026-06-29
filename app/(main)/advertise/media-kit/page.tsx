'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AdvertiseStats {
  totalTips: number | null;
  overallWinRate: number | null;
  monthlyPageviews: number | null;
  avgSessionMinutes: number | null;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K+';
  return String(n);
}

export default function MediaKitPage() {
  const [stats, setStats] = useState<AdvertiseStats | null>(null);

  useEffect(() => {
    fetch('/api/advertise/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stats) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [stats]);

  const pageviews   = stats?.monthlyPageviews != null ? fmt(stats.monthlyPageviews)       : '…';
  const tips        = stats?.totalTips        != null ? fmt(stats.totalTips)               : '…';
  const sessionMin  = stats?.avgSessionMinutes != null ? `${stats.avgSessionMinutes}m`     : '…';
  const winRate     = stats?.overallWinRate   != null ? `${stats.overallWinRate}%`         : '…';
  const winRateNote = stats?.overallWinRate   != null ? 'Settled tips win rate'            : 'No settled tips yet';

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; background: white; }
          .no-print { display: none !important; }
          .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; width: 100% !important; }
        }
        @page { size: A4; margin: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; }
      `}</style>

      {/* Controls bar — hidden when printing */}
      <div className="no-print flex items-center justify-between px-6 py-3 bg-white border-b text-sm">
        <Link href="/advertise" className="text-green-600 hover:underline font-medium">← Back to Advertise</Link>
        <div className="flex items-center gap-3">
          {!stats && (
            <span className="text-xs text-gray-400 animate-pulse">Loading live stats…</span>
          )}
          {stats && (
            <span className="text-xs text-gray-400">✓ Live data loaded</span>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-green-600 px-4 py-2 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Save as PDF / Print
          </button>
        </div>
      </div>

      {/* ── A4 PAGE ───────────────────────────────────────────── */}
      <div className="page mx-auto my-8 w-[794px] min-h-[1123px] bg-white shadow-xl rounded-lg overflow-hidden" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', padding: '40px 48px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Betcheza</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, letterSpacing: 1 }}>MEDIA KIT 2026</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>partnerships@betcheza.co.ke</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>betcheza.co.ke</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>WhatsApp: +254 113 226 240</div>
            </div>
          </div>
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              Reach Kenya's most engaged sports bettors
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 8, maxWidth: 500, lineHeight: 1.6 }}>
              Betcheza is Kenya's leading sports predictions community — a highly engaged, mobile-first audience actively comparing bookmakers, odds, and betting insights every day.
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 48px' }}>

          {/* Platform Stats — live from DB */}
          <SectionTitle>Platform at a Glance</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
            {[
              { value: pageviews,  label: 'Monthly Pageviews', sub: 'Rolling 30 days' },
              { value: tips,       label: 'Tips on Platform',   sub: 'All-time predictions' },
              { value: sessionMin, label: 'Avg. Session Time',  sub: 'High intent audience' },
              { value: winRate,    label: 'Platform Win Rate',  sub: winRateNote },
            ].map(({ value, label, sub }) => (
              <div key={label} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#111', marginTop: 2 }}>{label}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Two columns: Demographics + Ad Placements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

            {/* Audience Demographics */}
            <div>
              <SectionTitle>Audience Demographics</SectionTitle>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                <DemoGroup title="📍 Geography">
                  {[['Kenya', 78], ['East Africa (total)', 93], ['Uganda', 6], ['Tanzania', 5]]}
                </DemoGroup>
                <DemoGroup title="👤 Age Breakdown">
                  {[['Age 18–24', 31], ['Age 25–34', 44], ['Age 35–44', 18], ['Age 45+', 7]]}
                </DemoGroup>
                <DemoGroup title="📱 Device Split">
                  {[['Mobile', 87], ['Desktop / Tablet', 13]]}
                </DemoGroup>
                <DemoGroup title="⚽ Sports Interest" last>
                  {[['Football', 74], ['Basketball', 9], ['Tennis', 7], ['Rugby', 5]]}
                </DemoGroup>
              </div>
            </div>

            {/* Ad Placements */}
            <div>
              <SectionTitle>Ad Placements Available</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { title: 'Homepage Banner', desc: 'First impression — seen by every visitor', spec: '1200×120px desktop · 375×80px mobile' },
                  { title: 'Match Pages — Bookmaker Card', desc: 'Shown alongside odds when users decide where to bet', spec: 'Logo + offer + CTA · highest intent' },
                  { title: 'In-Feed Sponsored Tips', desc: 'Native cards in Community Feed & Tipsters pages', spec: 'Blends with content · sponsored label' },
                  { title: 'Jackpot Page — Exclusive Sponsor', desc: 'Peak excitement traffic · only 1 slot', spec: 'Full-width banner · jackpot listing' },
                  { title: 'Email Newsletter', desc: 'Weekly tips email · opted-in subscribers', spec: 'Logo + headline + CTA link' },
                ].map(({ title, desc, spec }) => (
                  <div key={title} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>{title}</div>
                    <div style={{ fontSize: 10, color: '#374151', marginTop: 1 }}>{desc}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>{spec}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Packages */}
          <SectionTitle>Advertising Packages</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              {
                name: 'Starter', price: 'KES 25,000/mo', highlight: false,
                features: ['Homepage banner (mobile)', 'Bookmaker card — 5 pages/day', 'Monthly performance report', '1-month minimum'],
              },
              {
                name: 'Growth', price: 'KES 60,000/mo', highlight: true,
                features: ['Homepage banner (desktop + mobile)', 'Bookmaker card — all match pages', '2× in-feed tips/week', 'Email newsletter', 'Dedicated account manager', 'Monthly performance report'],
              },
              {
                name: 'Premium', price: 'Custom', highlight: false,
                features: ['All Growth features', 'Jackpot page exclusive', 'Weekly in-feed tips', 'AI Predictor logo', 'Push notification sponsorship', 'Co-branded challenge', 'Quarterly strategy review'],
              },
            ].map(({ name, price, highlight, features }) => (
              <div key={name} style={{
                border: highlight ? '2px solid #16a34a' : '1px solid #e5e7eb',
                background: highlight ? '#f0fdf4' : '#f9fafb',
                borderRadius: 8, padding: 12, position: 'relative',
              }}>
                {highlight && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{name}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: highlight ? '#16a34a' : '#111', margin: '2px 0 6px' }}>{price}</div>
                {features.map(f => (
                  <div key={f} style={{ fontSize: 10, color: '#374151', display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Partnership models */}
          <SectionTitle>Partnership Models</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { tag: 'CPA', color: '#2563eb', bg: '#eff6ff', desc: 'KES 1,500–5,000 per depositing player. Tracked via unique affiliate links. Monthly payout reconciliation.' },
              { tag: 'Rev Share', color: '#059669', bg: '#f0fdf4', desc: 'Minimum 30% NGR. Lifetime player attribution. No negative carryover.' },
              { tag: 'Hybrid', color: '#d97706', bg: '#fffbeb', desc: 'Lower CPA + ongoing revenue share. Best balance of upfront and recurring. Fully customisable terms.' },
            ].map(({ tag, color, bg, desc }) => (
              <div key={tag} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 4 }}>{tag}</div>
                <div style={{ fontSize: 10, color: '#374151', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Campaign Reporting Promise */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 2 }}>Campaign Reporting — Included with every partnership</div>
              <div style={{ fontSize: 10, color: '#1e3a8a', lineHeight: 1.5 }}>
                All partners receive monthly performance reports covering impressions, clicks, CTR and conversions — so you always know exactly what your budget is delivering.
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', borderRadius: 10, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Ready to reach Kenya's betting audience?</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>We respond within 24 hours with a custom proposal.</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>partnerships@betcheza.co.ke</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>WhatsApp: +254 113 226 240</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>betcheza.co.ke/advertise</div>
            </div>
          </div>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 9, color: '#9ca3af' }}>
            © 2026 Betcheza. All rights reserved. Stats are live figures pulled from the platform. Prices VAT exclusive. Subject to change without notice.
          </div>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingBottom: 4, borderBottom: '2px solid #16a34a', display: 'inline-block' }}>
      {children}
    </div>
  );
}

function DemoGroup({ title, children, last }: { title: string; children: [string, number][]; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 5 }}>{title}</div>
      {children.map(([label, pct]) => (
        <div key={label} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
            <span style={{ color: '#374151' }}>{label}</span>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 5, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
