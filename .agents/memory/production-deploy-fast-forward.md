---
name: VPS fast-forward deployment safety
description: Preserve server-local configuration and state, and stop deployment if the source update fails.
---

Never restart production after a failed source pull: the service can rebuild and reload successfully while still serving the previous checkout. Preserve server-local configuration and runtime data; avoid broad resets, clean commands, or stashing untracked state without review. If the restart script reloads from the process-manager config file, reapply and review local config changes before restarting.

**Why:** A production update was blocked by a local process-manager configuration change, but a separate restart still ran against the old checkout, making the deploy appear successful.

**How to apply:** Inspect server changes first, preserve only the specific local configuration that blocks the fast-forward, chain the pull and restart with `&&`, reapply/review process-manager config before restart, and verify the checked-out commit after deployment.
