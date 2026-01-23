# Accept/Mute/Block Status Sharing - Requirements Specification
## MVP Version (Circles Feature Deferred)

---

## Overview

Implement recipient-controlled status visibility via Contacts tab. When User A shares a status with User B for the first time, User B sees a pending indicator and can Accept/Mute/Block. This is a **status-driven connection system** - Friend records are created when recipients accept/mute (or when manually adding friends), not when initially sharing statuses.

**Note:** Circle functionality is **deferred for MVP**. Users share with individually selected contacts only. Circles will be added in a future iteration after data model and UI are finalized.

---

## Core Principles

1. **One-way friendships** - Each Friend record represents one direction of sharing (A → B is separate from B → A)
2. **Status-driven** - Friend records are created when recipients accept/mute status shares (or when manually adding friends), NOT when initially sharing statuses
3. **Recipient-controlled** - Only the recipient (B) decides if they want to see the sharer's (A) statuses
4. **Time-bound invitations** - Pending invitations expire automatically when status endTime passes (no Friend record created if expired)
5. **Instagram-style blocking** - Blocked users are completely invisible (don't appear in search or friend lists)

---

## Data Model Requirements

### Status Model Changes

**Add required field:**
- `sharedWith` - PostgreSQL native array of user IDs (String[]) representing recipients of this status
- **Type:** PostgreSQL native array (not JSON) for better query performance
- **Limit:** Maximum 100 recipients per status
- **Index:** GIN index required for efficient array queries: `CREATE INDEX idx_status_shared_with ON "Status" USING GIN ("sharedWith");`

**Purpose:** When creating a status, the user selects which contacts should receive it. This field stores those recipient IDs.

**Example:** If User A creates a status and shares with Users B, C, and D, then `sharedWith = ["user-b-id", "user-c-id", "user-d-id"]`

---

### Friend Model Changes

**⚠️ TERMINOLOGY NOTE:** The model is called "Friend" but represents **one-way sharing relationships**, not traditional mutual friendships. If this terminology is confusing for users or developers, consider renaming to "ShareRelationship" or "Connection" in the future. For now, we'll keep "Friend" but document it clearly as one-directional.

**CRITICAL: Friend records are ONE-DIRECTIONAL, not mutual friendships.**

The Friend model represents a one-way relationship:
- `Friend(userId=A, friendUserId=B)` means "A wants to share with B" (or "B receives from A")
- This is **separate** from `Friend(userId=B, friendUserId=A)` which means "B wants to share with A"

**Three relationship types exist:**
1. **Outgoing Only:** A has Friend record with B, but B doesn't have one with A (A shares → B)
2. **Incoming Only:** B has Friend record with A, but A doesn't have one with B (A receives ← B)  
3. **Mutual:** Both Friend records exist (A ↔ B, both share with each other)

**UI Requirement:** Display relationship direction with icons/indicators so users understand:
- → (Outgoing): "I share with them, they don't share with me"
- ← (Incoming): "They share with me, I don't share with them"
- ↔ (Mutual): "We both share with each other"

---

### Friend Model Fields

**Rename the existing model from `Contact` to `Friend` (or keep as `Friend` if already named that).**

**Required fields:**
- `id` - Unique identifier
- `userId` - The sharer (User A who is sharing)
- `friendUserId` - The recipient (User B who receives)
- `status` - Enum with values: `PENDING`, `ACCEPTED`, `MUTED`, `BLOCKED`
- `acceptedFromStatusId` - Nullable (String?) reference to which Status ID triggered this friendship acceptance
  - **Purpose:** Analytics/debugging - tracks which status message led to the acceptance
  - **When set:** Only when accepting from a status share (not for manual adds, preemptive blocks, etc.)
  - **Nullable:** Can be null if friend was added via other paths or if tracking isn't needed
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

**Required constraints:**
- Unique constraint on `(userId, friendUserId)` pair
- Index on `userId` for fast lookups
- Index on `friendUserId` for fast lookups
- Index on `status` for filtering

**Status field semantics (recipient perspective):**
- `PENDING` - Recipient (friendUserId) hasn't responded to sharer's (userId) shares yet
- `ACCEPTED` - Recipient accepted and can see all sharer's statuses
- `MUTED` - Recipient muted sharer (sharer's statuses hidden from main feed, viewable manually)
- `BLOCKED` - Recipient blocked sharer (sharer's statuses never visible, sharer cannot find recipient)

**Important:** This is a **single status field** controlled by the recipient (friendUserId). There should be no separate "recipientStatus" or dual-status approach.

**Remove if present:**

## Database Migration Strategy

1. If table is named `Contact`, rename to `Friend`
2. Drop any old status-related fields and enums
3. Add new `status` enum with values: `PENDING`, `ACCEPTED`, `MUTED`, `BLOCKED`
4. Set default value to `PENDING`
5. For existing data: Set all existing friendships to `ACCEPTED` (grandfather them in)
6. Remove `expiresAt` field if it exists
7. **Add `sharedWith` field to Status model:**
   - Type: PostgreSQL native array `String[]`
   - Default: Empty array `[]`
   - **Add GIN index:** `CREATE INDEX idx_status_shared_with ON "Status" USING GIN ("sharedWith");`
8. **Add `acceptedFromStatusId` field to Friend model:**
   - Type: `String?` (nullable)
   - Foreign key reference to Status.id (optional)
   - Default: `null`

---

## Behavioral Requirements

### 1. Friend Record Creation (Status Share Path Only)

**Single Path: Status Share (No Friend Record Initially)**
- User A creates a status and selects recipients (either by manually selecting contacts or via predefined circles)
- User A includes User B in `sharedWith` array (B not a friend yet)
- **NO Friend record created at this time** - only Status record with `sharedWith` array
- B sees pending request via Status.sharedWith query (not Friend record)
- B can Accept/Mute/Block, which **then** creates the Friend record

**Result:** 
- Friend record is created only when recipient takes action (accept/mute)
- If status expires without action, no Friend record is ever created
- "Manual add" is just the UI flow for selecting recipients before sharing - it's still the status share path

**Important:** Check if Friend record already exists before creating. Don't create duplicate records.

---

### 2. Status Sharing (No Friend Record Creation)

**When User A creates a status:**
- Status includes `sharedWith` array of user IDs
- **NO Friend records are created at this time**
- For each user ID in `sharedWith`:
  - Check if `Friend(userId=A, friendUserId=recipientId)` exists with `status=BLOCKED`
  - If blocked, silently exclude from sharing (don't add to `sharedWith`)
  - If not blocked, include in `sharedWith` array
- Status is created with `sharedWith` array stored on Status model

**Important:** 
- Friend records are **NOT** created when sharing statuses
- Friend records are only created when recipient takes action (accept/mute)
- If status expires without recipient action, no Friend record is ever created
- `sharedWith` is stored on the Status model itself (PostgreSQL native array with GIN index)
- Maximum 100 recipients per status

---

### 3. Activity Feed Filtering (Main Feed)

**Show statuses from people whose shares I've accepted (incoming relationships):**

**Default behavior (main Activity feed):**
- Query Friend records where `friendUserId=currentUser` (incoming - people sharing with me)
- Filter by `status=ACCEPTED` (I've accepted their shares)
- Never show statuses from friends where `status=PENDING`, `MUTED`, or `BLOCKED`

**With "Show everyone" filter enabled:**
- Query Friend records where `friendUserId=currentUser`
- Filter by `status=ACCEPTED` OR `status=MUTED`
- Still never show `PENDING` or `BLOCKED`

**Key Understanding:**
- Activity feed shows statuses from "incoming" relationships (where I'm the recipient)
- I only see statuses from people whose shares I've accepted
- This is independent of whether I share with them (outgoing relationship)

---

### 4. Pending Friends Query

**Requirements:**
- Query Status records where current user's ID is in `sharedWith` array (using GIN index for performance)
- Filter to only active statuses (current time < status.endTime AND current time >= status.startTime)
- For each matching status, get the sharer (status.userId)
- **Exclude sharers who already have Friend record with current user** where `status=ACCEPTED`, `MUTED`, or `BLOCKED`
- Return list of unique sharers with their active status information

**Key Logic:**
- Only checks Status.sharedWith array (no Friend records with PENDING status exist)
- If Friend record exists with ACCEPTED/MUTED/BLOCKED → don't show as pending (already handled)
- If Friend record doesn't exist → show as pending (recipient hasn't responded yet)
- When status expires → automatically disappears from pending list (no active status)
- Users can only have one active status at a time, so each sharer appears once in pending list

**Result:** When a status expires, pending invitations automatically disappear from the list. No manual cleanup needed. No Friend record is created if recipient never responds.

---

### 5. Accept Friendship

**Endpoint:** Accept a pending friendship

**Requirements:**
- Validate that sharer has at least one active status where current user is in `sharedWith` array (endTime > now)
- If no active status, return error: "This invitation has expired"
- Check if Friend record exists where `userId=sharerId` AND `friendUserId=currentUser`
- **If Friend record doesn't exist, create it** with `status=ACCEPTED`
- **If Friend record exists, update** `status` to `ACCEPTED`
- Store `acceptedFromStatusId` (optional: which status was accepted)

**Result:** Once accepted, Friend record is created (if new) or updated (if existing), and recipient sees all future statuses from sharer (until muted/blocked).

---

### 6. Mute Friendship

**Endpoint:** Mute a friendship

**Requirements:**
- **Can be done anytime** - no validation required for active status
- Check if Friend record exists where `userId=sharerId` AND `friendUserId=currentUser`
- **If Friend record doesn't exist, create it** with `status=MUTED`
- **If Friend record exists, update** `status` to `MUTED`

**Behavior:**
- Friend record is created (if new) or updated (if existing) with MUTED status
- Sharer's statuses hidden from recipient's main Activity feed
- Recipient can still view sharer's status by:
  - Toggling "Show everyone" in Activity tab
  - Manually visiting sharer's profile
- Sharer has no idea they were muted

---

### 7. Block Friendship (Works from Any State)

**Endpoint:** Block a friendship

**Requirements:**
- User can block another user at ANY time:
  - Before any interaction (preemptive block)
  - While pending (block instead of accept)
  - After accepting (block existing friend)
- Find Friend record where `userId=sharerId` AND `friendUserId=currentUser`
- If doesn't exist, create it with `status=BLOCKED` (preemptive block)
- If exists, update `status` to `BLOCKED`

**Preemptive Blocking (No Prior Interaction):**
```
1. User B signs up
2. User B searches for User A
3. User B clicks "Block" (they've never interacted)
4. Friend record created: Friend(userId=A, friendUserId=B, status=BLOCKED)
5. Now A cannot share with B or find B in search
```

**Blocking Pending Request:**
```
1. User A shares status with User B
2. No Friend record exists yet (only Status with sharedWith)
3. User B clicks "Block" instead of Accept
4. Friend record created: status=BLOCKED
```

**Blocking Existing Friend:**
```
1. User A and B have been sharing (status=ACCEPTED)
2. User B decides to block
3. Friend record updated: status=BLOCKED
```

**Behavior (Instagram-style):**
- Sharer's statuses never visible to recipient
- **Sharer cannot find recipient in search** (filtered out)
- **Sharer cannot see recipient in friends list** (filtered out)
- Recipient is completely invisible to sharer
- Sharer doesn't know if blocked, deactivated, or username changed

---

### 8. User Search Filtering

**Endpoint:** Search for users (REQUIRED - must implement)

**Requirements:**
- **New endpoint needed:** `GET /users/search?q=query`
- Return users matching search query (by name, email, username, etc.)
- **Exclude users who have blocked the current user**
- Query Friend records where `friendUserId=currentUser` AND `status=BLOCKED`, collect `userId` values
- Filter these user IDs out of search results

**Behavior:**
- If B blocked A, then A searches for B → B doesn't appear in results
- No special UI handling needed - blocked users simply don't exist

**Note:** This is a NEW endpoint that needs to be created. Currently only contact matching by phone hash exists.

---

### 9. Friends List Filtering and Display

**Endpoint:** Get my friends

**Requirements:**
- Return Friend records where `userId=currentUser` OR `friendUserId=currentUser`
- **Exclude friends where `status=BLOCKED`**
- Display with relationship type indicators

**Three Relationship Types to Display:**

1. **Outgoing (→):** Friend records where `userId=currentUser` (I share with them)
2. **Incoming (←):** Friend records where `friendUserId=currentUser` (they share with me)
3. **Mutual (↔):** Both Friend records exist (we share with each other)

**UI Requirements:**
- Show visual indicator (arrow icon) for each friend showing relationship type
- → means "I share with them, they don't share with me"
- ← means "They share with me, I don't share with them"
- ↔ means "We both share with each other"

**Behavior:**
- If B blocked A, then A views friends list → B doesn't appear (filtered out)
- B has disappeared completely from A's world

---

### 10. Status Sharing Blocked User Filtering

**When creating a status:**
- Get list of users who have blocked current user
- Query Friend records where `friendUserId=currentUser` AND `status=BLOCKED`, collect `userId` values
- Filter these user IDs out of `sharedWith` array before creating status
- Silently exclude blocked users - don't notify sharer
- Enforce maximum limit of 100 recipients in `sharedWith` array

**Behavior:**
- If B blocked A, and A tries to share with B → status not sent to B, A doesn't know

---

## Frontend Requirements

### Contacts Tab

**Friends List Display:**
- Show all Friend relationships (both incoming and outgoing)
- Display relationship type indicator for each friend:
  - **→ (Outgoing):** You share with them, they don't share with you
  - **← (Incoming):** They share with you, you don't share with them
  - **↔ (Mutual):** You both share with each other
- Determine relationship type by checking both directions:
  - If only `Friend(userId=me, friendUserId=them)` exists → Outgoing (→)
  - If only `Friend(userId=them, friendUserId=me)` exists → Incoming (←)
  - If both exist → Mutual (↔)

**Pending Indicator:**
- Poll `/friends/pending` endpoint every 30 seconds
- Poll when app comes to foreground
- Show badge with count when `pendingFriends.length > 0`
- Badge should appear on tab bar and in tab header

**Filter Toggle:**
- Clicking badge toggles between "All Contacts" and "Pending Only" view
- When in pending view, show only pending friends
- Each pending friend shows Accept/Mute/Block buttons

**Action Buttons (in pending view only):**
- Accept button (green)
- Mute button (gray)
- Block button (red)

**After action:**
- Invalidate relevant queries (pending friends, all friends, statuses)
- If all pending friends processed, auto-exit filter view

---

### Activity Tab

**Main Feed:**
- Show statuses from `ACCEPTED` friends only (default)
- Poll every 10 seconds

**Muted Filter:**
- Add toggle button "Show everyone"
- When enabled, show statuses from both `ACCEPTED` and `MUTED` friends
- Muted items should show visual indicator (bell with cross-out icon)

**Purpose:** If main priority friends aren't available, user can check muted friends for hangout options.

---

### User Search Modal

**Requirements:**
- Call search endpoint with query
- Display results normally
- **No special handling needed** - blocked users already filtered by backend
- Just render the list of users returned

**Behavior:**
- Users who blocked you simply don't appear
- Clean and simple implementation

---

### Contact Detail Screen

**For muted contacts:**
- Allow viewing their current status even if muted
- User can manually navigate to contact's profile to check status
- Supports the "can view if curious" use case for muted contacts

---

### Tab Bar Badge

**Requirements:**
- Show red badge on Contacts tab when pending friends exist
- Badge should show count
- Update badge when polling detects changes

---

## User Flows

### Flow 1: Status Share (Friend Record Created on Accept/Mute)

```
1. User A creates status "Available for coffee, 2pm-5pm"
2. User A selects recipients in sharedWith field
3. User A selects User B (not in friends yet)
4. Backend creates Status with sharedWith=["B's ID", ...]
   - NO Friend record created at this time
5. User B's app polls /friends/pending
   - Query finds Status where B is in sharedWith and status is active
6. User B sees badge on Contacts tab: "1 Pending"
7. User B opens Contacts tab, clicks badge
8. Filter view shows User A with Accept/Mute/Block buttons
9. User B clicks "Accept" (before 5pm expiration)
10. Backend creates Friend(userId=A, friendUserId=B, status=ACCEPTED)
    - Friend record created NOW (not when status was shared)
11. User B now sees all User A's future statuses in Activity feed

Result: Friend relationship created (A → B) only after B accepts
```

**Alternative: User B clicks "Mute" instead:**
- Backend creates Friend(userId=A, friendUserId=B, status=MUTED)
- Friend record created, but statuses hidden from main feed

**If status expires without action:**
- No Friend record is ever created
- User A can share again in the future, and process repeats

**Key Point:** 
- Friend record is created only when recipient accepts/mutes
- If recipient never responds and status expires, no Friend record is created
- "Manual add" is just the UI flow for selecting recipients - it's still the status share path

---

### Flow 2: Relationship Type Indicators (Outgoing/Incoming/Mutual)

```
**Scenario: User A and User B interactions over time**

Initial state: No Friend records exist

Step 1: User A shares status with User B
- Status created with sharedWith=["B's ID"]
- NO Friend record created yet
- User B's view: Sees pending request from A (from Status.sharedWith query)

Step 2: User B accepts A's share
- Friend(userId=A, friendUserId=B, status=ACCEPTED)
- User A's view: Shows "B" with → (outgoing) - "You share with B"
- User B's view: Shows "A" with ← (incoming) - "A shares with you"
- User B can see A's statuses in Activity feed

Step 3: User B decides to share with User A
- User B shares status with A (sharedWith=["A's ID"])
- NO Friend record created yet
- User A sees pending request from B (from Status.sharedWith query)

Step 4: User A accepts B's share
- Friend(userId=B, friendUserId=A, status=ACCEPTED)
- User A's view: Shows "B" with ↔ (mutual) - "You both share"
- User B's view: Shows "A" with ↔ (mutual) - "You both share"
- Both can see each other's statuses

**Three States Visualized:**
→ Only Friend(A→B) exists: A shares with B (B sees ← from their perspective)
← Only Friend(B→A) exists: B shares with A (A sees → from their perspective)
↔ Both Friend(A→B) and Friend(B→A) exist: Mutual sharing
```

---

### Flow 3: Pending Expiration (Auto-Cleanup, No Friend Record)

```
1. User A shares status with User B (expires 5pm)
   - Status created with sharedWith=["B's ID"]
   - NO Friend record created
2. User B sees pending indicator (from Status.sharedWith query)
3. User B doesn't respond
4. 5:01pm - status expires (endTime passed)
5. User B's app polls /friends/pending
6. Query filters: Status where B is in sharedWith AND status is active
7. No active status found → User A not in results
8. Pending count decreases to 0
9. Badge disappears from Contacts tab
10. No Friend record was ever created (clean slate)
```

**Key:** 
- No manual cleanup job needed. Query naturally excludes expired statuses.
- No Friend record exists, so nothing to clean up.
- User A can share again in the future, and process repeats from scratch.

---

### Flow 4: Instagram-Style Blocking

```
1. User A and User B have been sharing statuses
2. User B sees User A's status in Activity feed
3. User B decides to block User A
4. User B clicks "Block" button (from contact detail or pending view)
5. Backend updates Friend(userId=A, friendUserId=B).status = BLOCKED
6. User B disappears from User A's friends list (filtered by backend)
7. User B's statuses disappear from User A's Activity feed
8. User A creates new status
9. User A searches for User B → User B doesn't appear in results
10. User A checks friends list → User B not there
11. User A wonders: "Did B deactivate? Block me? I don't know."
```

**Key Behavior:** User B is completely invisible to User A. Maximum privacy.

---

### Flow 5: Mute vs Block Comparison

**Mute:**
- Sharer's statuses hidden from main Activity feed
- Can toggle "Show everyone" to see them
- Can manually visit sharer's profile
- Sharer can still find you in search
- Sharer can still see you in friends list
- Low-key way to reduce noise

**Block (Instagram-Style):**
- Sharer's statuses never visible (even with "Show everyone")
- Sharer cannot find you in search (you're filtered out)
- Sharer cannot see you in friends list (you're filtered out)
- Complete invisibility
- Hard boundary when needed

---

## Edge Cases

### 1. Bidirectional Friendships
```
Scenario: User A shares with User B, then User B shares with User A

Result: Two separate Friend records exist
- Friend(userId=A, friendUserId=B)
- Friend(userId=B, friendUserId=A)

Each person controls their own receiving preferences independently.
Both can accept, mute, or block independently.
```

---

### 2. Multiple Statuses Before Acceptance
```
Scenario: User A shares 3 statuses with User B before User B accepts

Result: 
- NO Friend records created yet (only Status records with sharedWith)
- User B sees pending indicator as long as ANY status is active (from Status.sharedWith query)
- If Status 1 expires but Status 2 is active → still pending
- If all statuses expire → pending disappears, no Friend record created
- Once User B accepts → Friend record created with status=ACCEPTED
- After acceptance, User B sees all future statuses from User A
```

---

### 3. Accept After Block
```
Scenario: User B blocks User A, then tries to accept later

Result: Cannot accept while blocked
- User B must unblock first (future feature: settings screen)
- Then User B can accept next time User A shares
```

---

### 4. Search for Blocked User
```
Scenario: User B blocked User A, then User A searches for User B

Result: User B does NOT appear in search results
- Backend filters out users who blocked you
- Consistent with Instagram/Twitter behavior
```

---

## Privacy & Security

### What Sharer Cannot See:
- Whether recipient accepted, muted, or blocked
- Friend status field value
- Any indication of recipient's choice

### What Recipient Can See:
- Pending friendships from sharers
- Their own status choices (accepted, muted, blocked)
- Statuses from accepted friends (or muted if filter enabled)

### What Happens When Blocking:
- Sharer cannot find recipient in search
- Sharer cannot see recipient in friends list
- Recipient is completely invisible
- Maximum privacy and separation

---

## API Endpoints Summary

### Friend Management
- `GET /friends/pending` - Get pending friendships with active statuses (queries Status.sharedWith, incoming only)
- `POST /friends/:sharerId/accept` - Accept pending friendship (validates not expired, creates Friend record if new)
- `POST /friends/:sharerId/mute` - Mute a friendship (can be done anytime, creates Friend record if new)
- `POST /friends/:sharerId/block` - Block a friendship (works from any state, including preemptive, creates Friend record if new)
- `GET /friends` - Get all friends with relationship type indicators (excludes BLOCKED)

### User Search (NEW - REQUIRED)
- `GET /users/search?q=query` - Search users by name/email (excludes users who blocked you)

### Status
- `GET /status/friends?includeMuted=true` - Get friends' statuses (optionally include muted)
- `POST /status` - Create status with `sharedWith` array (max 100 recipients, does NOT create Friend records, filters blocked users from sharedWith)

---

## Polling Strategy

**Pending Friends:**
- Poll every 30 seconds when app is open
- Poll immediately when app comes to foreground
- Stop polling when app goes to background

**Friends' Statuses (Activity Feed):**
- Poll every 10 seconds for active statuses
- Standard refresh behavior

---

## Testing Requirements

### Backend
- **NO Friend record created when sharing status** (only Status with sharedWith array)
- **sharedWith uses PostgreSQL native array** with GIN index for performance
- **Maximum 100 recipients per status** enforced
- Pending friends query queries Status.sharedWith using GIN index (not Friend records)
- Pending friends query only returns sharers with active statuses
- Accept validates status hasn't expired
- Accept **creates** Friend record with status=ACCEPTED (if new) or **updates** (if exists)
- Accept stores `acceptedFromStatusId` (nullable) for analytics
- Mute can be done anytime (no validation required)
- Mute **creates** Friend record with status=MUTED (if new) or **updates** (if exists)
- Block creates/updates Friend record with status=BLOCKED (Instagram-style, not separate table)
- User search filters out users who blocked you (queries Friend where friendUserId=currentUser AND status=BLOCKED)
- Friends list filters out BLOCKED friends
- Status feed excludes BLOCKED friends
- Status feed includes MUTED when includeMuted=true
- Status creation filters out blocked users from sharedWith array (queries Friend where friendUserId=currentUser AND status=BLOCKED)
- Cannot share status with users who have blocked you (filtered from sharedWith)

### Frontend
- Pending badge appears when pending friends exist
- Pending count updates when polling
- Clicking badge toggles filter view
- Accept/Mute/Block buttons work and invalidate queries
- Blocked users don't appear in search
- Blocked users don't appear in friends list
- "Show everyone" toggle works in Activity tab
- Muted statuses show visual indicator
- Can view muted friend's status on their profile
- Tab bar badge shows correct count

### Edge Cases
- Multiple pending statuses from same sharer (no Friend record yet)
- Accept before expiration succeeds (creates Friend record)
- Accept after expiration fails (no Friend record created)
- Mute before expiration succeeds (creates Friend record with MUTED)
- Pending disappears when status expires (no Friend record created)
- Cannot re-share with blocked user (filtered from sharedWith)
- Cannot re-add blocked user (filtered from search)
- Bidirectional friendships work independently
- Status expires without action → no Friend record, clean slate for future

---

## Performance Considerations

### Polling
- 30-second interval for pending: 100 users × 2 req/min = 3.3 req/sec (acceptable)
- 10-second interval for statuses: Already implemented

### Database Queries
- **GIN index on Status.sharedWith:** `CREATE INDEX idx_status_shared_with ON "Status" USING GIN ("sharedWith");` for efficient array queries
- Index on `Friend.status` for fast filtering
- Index on `Status.endTime` for expiration checks
- Query for pending friends uses GIN index for array containment checks

### Filtering
- Backend filtering (not frontend) for blocked users
- Single query to get blocked user IDs, then filter in application or SQL

---

## Future Enhancements (Not MVP)

### Circles (Deferred)
- Circle model with name and members
- Share status with entire circle
- Free tier: 2 circles max
- Premium: Unlimited circles
- When blocking: Auto-remove blocked user from all circles

### Other Future Features
- Unblock functionality (settings screen)
- Change muted to accepted (settings screen)
- Push notifications for pending friends
- Batch accept/mute/block
- Analytics

---

## Summary

This specification implements a **recipient-controlled, status-driven friendship system** with:

✅ **One-way Friend records** (A → B separate from B → A, NOT mutual friendships)
✅ **Single Friend creation path** (status share, Friend record created only on recipient accept/mute)
✅ **Friend records created only on recipient action** (accept/mute) - NOT on initial status share
✅ **No Friend record if status expires** (clean slate for future sharing)
✅ **Relationship type indicators** (→ outgoing, ← incoming, ↔ mutual)
✅ **Required sharedWith field** on Status model (PostgreSQL native array, max 100 recipients, GIN index)
✅ **Pending friends query uses Status.sharedWith** (not Friend records, uses GIN index for performance)
✅ **Time-bound pending invitations** (auto-expire with status, no Friend record created)
✅ **Instagram-style blocking** (Friend.status=BLOCKED, not separate table, blocked users completely invisible)
✅ **Preemptive blocking** (can block before any interaction, creates Friend record with BLOCKED)
✅ **Clean mute functionality** (can mute anytime, hidden from main feed, viewable manually)
✅ **User search endpoint** (NEW - must implement, filters blocked users correctly)
✅ **Simple polling** (30s for pending, 10s for statuses)
✅ **Backend filtering** for performance and consistency
✅ **Circles deferred** for future implementation

**Key Architectural Points:**
- Friend model represents one-directional sharing (terminology may be confusing, consider renaming in future)
- Status model MUST have sharedWith array (PostgreSQL native array with GIN index)
- **Friend records are NOT created when sharing statuses** - only when recipient accepts/mutes
- **Pending friends query queries Status.sharedWith using GIN index** (not Friend.status=PENDING)
- Activity feed shows incoming accepted friends only (where I'm the recipient)
- Friends list shows both incoming and outgoing with relationship indicators
- Blocking uses Friend.status=BLOCKED (Instagram-style, not separate table)
- Blocking works from any state (pending, accepted, or even preemptively)
- If status expires without recipient action, no Friend record is created (clean slate)
- Users can only have one active status at a time, simplifying pending queries

**The system follows industry standards (Instagram/Twitter), is logically consistent, and ready to implement for MVP.**