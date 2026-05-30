---
name: Notification bell components
description: Two separate bell components must both be updated for any bell/badge changes
---

- `components/notifications/notification-bell.tsx` — used in main layout via dynamic import
- `components/layout/notification-bell.tsx` — used in `header.tsx`
- Badge threshold: shows `20+` when unread count >= 20 (not 99+)
- Unread count comes from `getUnreadCount()` API, not from counting the fetched list (which is capped at limit=20)

**Why:** Both components are independent; changing only one leaves the other inconsistent.
