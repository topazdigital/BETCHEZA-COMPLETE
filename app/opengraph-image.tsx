import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Betcheza — Sports Betting Tips & AI Predictions';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern dots */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          display: 'flex',
        }} />

        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.25) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 90,
          height: 90,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          marginBottom: 24,
          boxShadow: '0 0 60px rgba(16,185,129,0.5)',
        }}>
          <span style={{ fontSize: 48 }}>⚽</span>
        </div>

        {/* Site name */}
        <div style={{
          fontSize: 72,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-2px',
          display: 'flex',
          gap: 0,
        }}>
          <span style={{ color: '#10b981' }}>Bet</span>
          <span>cheza</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 28,
          color: '#94a3b8',
          marginTop: 12,
          fontWeight: 500,
          display: 'flex',
        }}>
          Kenya&apos;s #1 Sports Betting Tips Community
        </div>

        {/* Feature pills */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 40,
        }}>
          {['🤖 AI Predictions', '🏆 Expert Tipsters', '📊 Live Odds', '💰 Jackpot Tips'].map((label) => (
            <div key={label} style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 999,
              padding: '8px 18px',
              color: '#10b981',
              fontSize: 18,
              fontWeight: 600,
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{
          position: 'absolute',
          bottom: 36,
          color: '#475569',
          fontSize: 18,
          display: 'flex',
        }}>
          betcheza.co.ke
        </div>
      </div>
    ),
    { ...size }
  );
}
