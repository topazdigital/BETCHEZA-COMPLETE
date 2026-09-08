---
name: Imported project dependency setup
description: Startup behavior to expect when a GitHub project is first imported into Replit
---

An imported Node/Next.js project can have a complete package manifest and lockfile while still lacking `node_modules`, causing the workflow to fail immediately with a command-not-found error.

**Why:** The failure occurs before application code loads, so changing routes or runtime configuration would not address the unavailable preview.

**How to apply:** Check for `node_modules` and the workflow's first error before debugging source code. Install from the project's declared dependencies, restart the workflow, verify `/` returns 200, and run the production build before suggesting publish.