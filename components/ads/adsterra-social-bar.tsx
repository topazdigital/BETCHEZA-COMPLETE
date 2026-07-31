'use client'

import Script from 'next/script'

/**
 * Adsterra Social Bar — sticky icon-cluster widget, loads once globally.
 * Adsterra recommends placing it right above </body>.
 * We render it here and import it in the root layout.
 */
export function AdsterraSocialBar() {
  return (
    <Script
      id="adsterra-social-bar"
      src="https://pl30417383.effectivecpmnetwork.com/7a/3a/f9/7a3af97a79c77a7fe5e1183dfe7b4dd1.js"
      strategy="lazyOnload"
    />
  )
}
