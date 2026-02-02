# Plan: On my way

## Overview

When a user (A) sees a friend’s (B’s) status, they can tap **“On my way”** to record that they’re heading to B’s hang. B sees who’s on their way; A can cancel or have that state cleared when the event ends or is cancelled.

---

## Done

### Recording “On my way”

- **DB:** `Status.onMyWayUserIds` (String[], default []) in `backend/prisma/schema.prisma`. Column added (migration or raw SQL if needed).
- **Backend API:**
  - `POST /status/:statusId/on-my-way` — add current user to `onMyWayUserIds` (status exists, active, user in `sharedWith`, user not already on their way to another status).
  - `DELETE /status/:statusId/on-my-way` — remove current user from `onMyWayUserIds`.
  - Constraint: at most one “on my way” per user at a time (enforced in service and frontend).
- **Frontend:** `setOnMyWay(statusId)`, `cancelOnMyWay(statusId)` in `mobile-app/lib/api.ts`; `ContactStatus.onMyWayUserIds` in `mobile-app/lib/types.ts`.

### “On my way” button (contact detail)

- **File:** `mobile-app/app/contact/[id].tsx`
- **States:** “On my way” (not yet on way) and “You’re on your way” (on way to this status). Confirm before set/cancel.
- **Disabled:** When user has an active status or is already on their way to a *different* status; grey style, no dialog, hint text below.
- Checkmark (no car icon) when “You’re on your way”.

### Top status row (Activity tab)

- **File:** `mobile-app/app/(tabs)/activity/index.tsx`
- Default: “What are you up to?”
- User on their way: secondary text **non-possessive** — e.g. “You are hanging out with Alice” (not “Alice’s”). Tap goes to that contact’s status screen (can cancel).
- User cancels: row resets to “What are you up to?”
- Host cancels: show “Name has cancelled their hang” (from backend end-reason when implemented); tap → set-status, dismiss.
- Event expires: row resets to “What are you up to?” (no special message).

### Current-user caching

- `staleTime: Infinity` for all `['current-user']` queries (contact detail, activity index, profile).
- After sign-in: `queryClient.setQueryData(['current-user'], user)` in `mobile-app/app/(auth)/sign-in.tsx`.
- On sign-out: `queryClient.removeQueries({ queryKey: ['current-user'] })` in HamburgerMenu, profile, SignOutButton.
- Backend: Clerk fetch failures return 502 with clear message.

---

## Remaining

### Backend: soft-ending statuses (scalability / reliability)

- **Schema:** Add to `Status` in `backend/prisma/schema.prisma`:
  - `endedAt: DateTime?`
  - `endReason: String?` (e.g. `cancelled_by_host` | `expired`).
  - `acknowledgedByUserIds String[] @default([])` — user IDs who have dismissed the "host cancelled" message for this status (show it only once per user).
- **Clear status (host):** When host clears their status, **update** the status row: set `endedAt = now`, `endReason = 'cancelled_by_host'` instead of deleting.
- **Expiry:** In `cleanupExpiredStatuses` (cron), **update** statuses that have passed `endTime`: set `endedAt = now`, `endReason = 'expired'` instead of deleting.
- **Active reads:** `getFriendsStatuses` and `getCurrentStatus` only return rows where `endedAt is null`.
- **New API:** `GET /status/me/ended-attendances` — statuses where current user is in `onMyWayUserIds` and `endedAt` is not null; include host user. For `endReason === 'cancelled_by_host'`, exclude statuses where current user is in `acknowledgedByUserIds` (so host-cancelled is only returned until the user acknowledges).
- **New API:** `POST /status/:statusId/acknowledge-cancelled` — add current user's ID to `acknowledgedByUserIds` (validates user was in `onMyWayUserIds` and status is ended with `cancelled_by_host`). Called when user taps to dismiss the host-cancelled row.
- **Cleanup cron:** `cleanupEndedStatuses` — physically delete statuses where `endedAt` is older than e.g. 8 hours so the table stays bounded.

### Frontend: consume end reasons

- **API client:** Add `getEndedAttendances()` and `acknowledgeCancelled(statusId)` in `mobile-app/lib/api.ts`.
- **Activity tab:** Fetch ended-attendances; if a recent one has `endReason === 'cancelled_by_host'`, show “Name has cancelled their hang” in the top row; tap → set-status, call `acknowledgeCancelled(statusId)`, and dismiss (message not shown again). Do **not** show a special message for `expired`; just show “What are you up to?”.

---

## Summary

| Area              | Status   | Notes                                              |
|-------------------|----------|----------------------------------------------------|
| On my way record  | Done     | DB, POST/DELETE API, frontend client & types       |
| Contact button    | Done     | Set/cancel, disabled states, confirm dialogs       |
| Activity top row  | Done*    | *“Host cancelled” uses explicit end-reason when API is done |
| Current-user cache| Done     | Stale forever, prime on sign-in, clear on sign-out  |
| Soft-end statuses | Pending  | endedAt/endReason, update on clear/expire, filter  |
| ended-attendances | Pending  | GET + POST acknowledge-cancelled + cleanup cron; filter by acknowledgedByUserIds |
| Frontend end UX   | Pending  | getEndedAttendances, acknowledgeCancelled; "cancelled" shown once then dismissed |
