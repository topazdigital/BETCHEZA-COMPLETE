---
name: GitHub HTTPS push authentication
description: Authentication form that worked for pushing this repository from the Replit shell
---

For HTTPS pushes to the GitHub remote, use Basic authentication with username `x-access-token` and the workspace GitHub PAT. A Bearer authorization header was rejected even though the same token worked with Basic auth.

**Why:** GitHub accepted the repository push only with the standard token-as-password form.

**How to apply:** Keep the token in the workspace secret and construct the Basic header at command time; never print or paste the token into chat.