# Plan update: Presentational component (no "Contact not found")

## Change

- We do **not** need "Contact not found": if the user is on Plaza we can select them to add to a group; we just need a **presentational component for consistency** when viewing them.

## Contact screen behavior

**File:** `mobile-app/app/contact/[id].tsx`

1. **When a Friend record exists:** Show full contact UI as today (from `getContacts`).
2. **When no Friend record** (e.g. group member tap): Show a **presentational view** with at least name and consistent layout.
   - **Implementation:** From the group screen, navigate with query params (e.g. `name`, `firstName`, `lastName`, `from=group`). The contact screen reads `id` and params; if `contacts?.find(c => c.id === id)` is missing but we have `name` (or other params), render a minimal presentational component (name, avatar placeholder, same styling). No new backend endpoint. No "Contact not found".

## Summary bullet (replace in main plan)

- **Presentational component:** When the user has no Friend record (e.g. group member), the contact screen shows a consistent presentational view using name/display info from route params; no "Contact not found".
