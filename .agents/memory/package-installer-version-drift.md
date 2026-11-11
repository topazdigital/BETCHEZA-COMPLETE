---
name: Package installer version drift
description: Replit's language package installer may update existing npm dependency ranges while installing missing node_modules.
---

## Rule

When using `installLanguagePackages` in an imported Node project, compare `package.json` and the lockfile against the starting state afterward. The installer may rewrite existing dependency ranges to newer compatible versions even when the request only needed missing packages. If the firewall blocks a lockfile-pinned release for a security issue, install the latest compatible release of that package instead.

**Why:** An environment setup change can otherwise become an unrelated dependency upgrade, creating noisy diffs and changing the project's toolchain during feature work.

**How to apply:** Restore intentional dependency ranges, keep the lockfile root metadata aligned, and verify the build after dependency setup. The installer can also write internal package-firewall URLs into `resolved`; replace those with public npm registry URLs before shipping the lockfile.