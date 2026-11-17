---
name: GTmetrix and Turbopack
description: Homepage code-splitting guidance and a Replit-local Next.js preview failure that can be mistaken for a UI regression.
---

Keep the homepage's heavy match and side-panel components code-split when optimizing performance. Avoid adding a custom Webpack hook to the Turbopack configuration.

**Why:** This app's Next.js setup uses Turbopack, and a custom Webpack hook is not a reliable place for its module-resolution behavior.

**How to apply:** Preserve existing lazy imports for heavy homepage panels and check the current Next configuration before changing bundlers.

In this Replit workspace, a Turbopack dev panic was observed while transforming `app/globals.css`, reporting an off-workspace slide-template loader path. Clearing `.next` and removing the custom Webpack hook did not resolve it; trying Webpack dev produced a separate `mysql2`/`string_decoder` resolution error. This was a preview-toolchain problem, not evidence that the page component caused the failure.

**Why:** The app route returned a Turbopack runtime error before its page could render, while the isolated mockup preview and component typecheck succeeded.

**How to apply:** If this same class of preview failure returns, distinguish the dev toolchain failure from UI code and production health; do not change deployment settings just to mask it.
