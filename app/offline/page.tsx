import type { Metadata } from 'next'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: "You're Offline — Betcheza",
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-6 py-16">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-10 max-w-sm w-full text-center">
        <div className="text-6xl mb-5 leading-none">📡</div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">You&apos;re offline</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          No internet connection right now. You can still browse pages and tips
          you&apos;ve already visited — they&apos;re saved on your phone.
        </p>

        <ul className="bg-[#0f172a] rounded-xl px-5 py-4 mb-6 flex flex-col gap-3 text-left">
          {[
            'Previously viewed matches & scores',
            'Cached tips and predictions',
            'Leaderboard & tipster profiles',
            'Jackpot selections you\'ve opened',
          ].map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <a
          href="/"
          className="block w-full py-3 rounded-xl font-semibold text-white text-base
                     bg-gradient-to-r from-emerald-500 to-teal-500
                     hover:from-emerald-600 hover:to-teal-600 transition-opacity"
        >
          Try again
        </a>
        <p className="mt-3 text-xs text-slate-500">
          Reconnect to get live scores &amp; the latest tips
        </p>
      </div>
    </div>
  )
}
