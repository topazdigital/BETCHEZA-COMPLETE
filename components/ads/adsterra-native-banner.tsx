'use client'

import Script from 'next/script'

/**
 * Adsterra Native Banner — renders a 4:1 native ad grid inline.
 * Place once per page (single container ID). The ad blends with
 * tip cards; label "Sponsored" keeps it honest without being loud.
 */
export function AdsterraNativeBanner() {
  return (
    <div className="my-1">
      <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40 text-center mb-1">
        Sponsored
      </p>
      <Script
        id="adsterra-native"
        async
        data-cfasync="false"
        src="https://pl30417382.effectivecpmnetwork.com/10d037125e8a16999dae0f0a17ed22c4/invoke.js"
        strategy="lazyOnload"
      />
      <div id="container-10d037125e8a16999dae0f0a17ed22c4" />
    </div>
  )
}
