# Architecture Documentation

## Overview

The Social Availability App is a full-stack mobile application built with a NestJS backend and an Expo React Native frontend. The application allows users to share their availability status (Available/Questionable/Unavailable) with contacts and view their contacts' statuses in real-time.

## System Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Mobile App    │◄────────►│   Backend API   │◄────────►│   PostgreSQL    │
│  (Expo/React)   │  HTTP    │    (NestJS)     │  Prisma  │    Database     │
└─────────────────┘          └─────────────────┘          └─────────────────┘
       │                              │
       │                              │
       ▼                              ▼
┌─────────────────┐         ┌─────────────────┐
│  Clerk Auth     │         │  Clerk Auth     │
│  (Client SDK)   │         │  (Server SDK)   │
└─────────────────┘         └─────────────────┘
```

## Project Structure

```
plaza/
├── backend/              # NestJS backend API
│   ├── prisma/          # Database schema and migrations
│   ├── src/
│   │   ├── common/      # Shared utilities and guards
│   │   ├── modules/     # Feature modules
│   │   └── main.ts      # Application entry point
│   └── package.json
│
├── mobile-app/          # Expo React Native mobile app
│   ├── app/             # Expo Router file-based routing
│   ├── components/     # Reusable UI components
│   ├── lib/             # Utilities and API client
│   ├── stores/          # Zustand state management
│   └── package.json
│
└── README.md
```

---

## Backend Architecture

### Technology Stack
- **Framework**: NestJS 11.x
- **Database**: PostgreSQL with Prisma ORM 5.x
- **Authentication**: Clerk (server-side SDK)
- **Validation**: class-validator, class-transformer

### Directory Structure

```
backend/src/
├── main.ts                    # Application bootstrap
├── app.module.ts              # Root module
├── app.controller.ts           # Root controller
│
├── common/                     # Shared code
│   └── guards/
│       └── auth.guard.ts      # JWT authentication guard
│
└── modules/                    # Feature modules
    ├── users/
    │   ├── users.module.ts
    │   └── users.service.ts   # User management
    │
    ├── contacts/
    │   ├── contacts.module.ts
    │   ├── contacts.controller.ts
    │   ├── contacts.service.ts
    │   └── dto/
    │       └── add-contact.dto.ts
    │
    ├── status/
    │   ├── status.module.ts
    │   ├── status.controller.ts
    │   ├── status.service.ts
    │   └── dto/
    │       └── create-status.dto.ts
    │
    └── invites/
        ├── invites.module.ts
        ├── invites.controller.ts
        └── invites.service.ts
```

### Module Architecture

#### 1. Users Module
**Purpose**: User management and Clerk integration

- **Service**: `UsersService`
  - `findOrCreateByClerkId()` - Creates or retrieves user by Clerk ID
  - `findById()` - Retrieves user by internal ID

**Design Decision**: Users are created on-demand when they first authenticate, linking Clerk IDs to internal user records.

#### 2. Contacts Module
**Purpose**: Manage bidirectional contact relationships

- **Controller**: `ContactsController`
  - `GET /contacts` - Get user's accepted contacts
  - `POST /contacts` - Add a new contact (bidirectional)
  - `GET /contacts/pending` - Get pending contact invitations
  - `POST /contacts/:id/accept` - Accept a contact invitation

- **Service**: `ContactsService`
  - Manages bidirectional contact relationships
  - Handles contact invitation workflow

**Design Decision**: Contacts are bidirectional - when User A adds User B, both relationships are created automatically. This ensures both users can see each other's status.

#### 3. Status Module
**Purpose**: Manage user availability statuses

- **Controller**: `StatusController`
  - `POST /status` - Create a new status
  - `GET /status/me` - Get current user's active status
  - `GET /status/contacts` - Get all contacts' current statuses

- **Service**: `StatusService`
  - Creates time-windowed statuses
  - Queries active statuses (within time window)
  - Aggregates contacts' statuses

**Design Decision**: Statuses are time-windowed. Only statuses where `now` is between `startTime` and `endTime` are considered active. This allows users to set future availability.

#### 4. Invites Module
**Purpose**: Generate and manage invite codes for adding contacts

- **Controller**: `InvitesController`
  - `POST /invites/generate` - Generate new invite code (authenticated)
  - `GET /invites/:code` - Get invite details (public)
  - `POST /invites/:code/use` - Use invite code to add contact (authenticated)

- **Service**: `InvitesService`
  - Generates unique invite codes
  - Validates invite expiration
  - Creates bidirectional contacts when invite is used

**Design Decision**: Invites are public (no auth required to view), but require authentication to use. This enables deep linking from mobile apps.

### Authentication Flow

1. **Client Request**: Mobile app sends request with `Authorization: Bearer <token>` header
2. **Auth Guard**: `AuthGuard` intercepts request
3. **Token Verification**: Uses Clerk SDK to verify JWT token
4. **User Context**: Extracts `userId` (Clerk ID) from token and attaches to request
5. **Service Layer**: Services use `req.userId` to identify the authenticated user

**Security**: All protected routes use the `@UseGuards(AuthGuard)` decorator. The guard validates tokens server-side with Clerk.

### Database Schema

**Prisma Schema Location**: `backend/prisma/schema.prisma`

#### Models

1. **User**
   - Links Clerk authentication to internal user records
   - Stores email, name, phone (optional)
   - Relations: contacts, statuses, invites

2. **Contact**
   - Bidirectional relationship between users
   - Status: PENDING, ACCEPTED, BLOCKED
   - Unique constraint on `[userId, contactUserId]`

3. **Status**
   - Time-windowed availability status
   - Status: AVAILABLE, QUESTIONABLE, UNAVAILABLE
   - Includes optional message
   - Indexed on `userId` and `[startTime, endTime]` for efficient queries

4. **Invite**
   - Invite codes for adding contacts
   - Expires after 7 days
   - Tracks inviter and user who used the invite

**Design Decisions**:
- UUIDs for all IDs (better for distributed systems)
- Cascade deletes for data integrity
- Indexes on frequently queried fields
- Enums for status types (type safety)

---

## Mobile App Architecture

### Technology Stack
- **Framework**: Expo SDK 54 with Expo Router
- **Language**: TypeScript
- **State Management**: Zustand + React Query
- **Authentication**: Clerk (client SDK)
- **Navigation**: Expo Router (file-based routing)

### Directory Structure

```
mobile-app/
├── app/                      # Expo Router routes
│   ├── _layout.tsx          # Root layout (Clerk + React Query setup)
│   ├── (auth)/               # Auth route group
│   │   └── sign-in.tsx       # Email-based sign-in
│   ├── (tabs)/               # Tab navigation group
│   │   ├── _layout.tsx       # Tab layout with auth guard
│   │   ├── index.tsx         # Contacts list (home)
│   │   └── profile.tsx      # Set status & generate invites
│   ├── contact/
│   │   └── [id].tsx          # Contact detail screen
│   └── invite/
│       └── [code].tsx        # Invite acceptance screen
│
├── components/               # Reusable UI components
│   ├── ContactListItem.tsx  # Contact row with status indicator
│   ├── StatusPicker.tsx      # Three-state availability picker
│   └── TimeWindowPicker.tsx  # Time range selector
│
├── lib/                      # Utilities and helpers
│   ├── api.ts                # API client with auth
│   ├── tokenCache.ts         # Secure token storage
│   └── types.ts              # TypeScript type definitions
│
└── stores/                   # Zustand state stores
    └── userStore.ts          # User state management
```

### Routing Architecture

**Expo Router** uses file-based routing:

- `(auth)` - Route group for authentication screens
- `(tabs)` - Route group for main app tabs
- `[id]` - Dynamic route parameter
- `_layout.tsx` - Layout wrapper for route groups

**Navigation Flow**:
```
Sign In → Tabs (Home/Profile) → Contact Detail
                              → Invite Screen
```

### Component Architecture

#### 1. ContactListItem
**Purpose**: Display contact with status indicator

- Shows colored circle (green/yellow/red/gray) based on status
- Displays contact name/email
- Shows optional status message
- Navigates to contact detail on press

#### 2. StatusPicker
**Purpose**: Select availability status

- Three buttons: Available (green), Maybe (yellow), Unavailable (red)
- Visual feedback for selected state
- Calls `onChange` callback

#### 3. TimeWindowPicker
**Purpose**: Select time window for availability

- **Current Implementation**: Simplified display (MVP)
- Shows start and end times
- **Future Enhancement**: Add proper time picker component

### State Management

#### React Query (Server State)
- **Purpose**: Cache and sync server data
- **Queries**:
  - `contacts` - User's contact list
  - `contacts-statuses` - Contacts' current statuses (polls every 10s)
  - `my-status` - Current user's active status
  - `invite` - Invite details by code

- **Mutations**:
  - `createStatus` - Create new status
  - `generateInvite` - Generate invite code
  - `useInvite` - Accept invite

**Design Decision**: React Query handles caching, refetching, and optimistic updates. Status polling ensures real-time updates.

#### Zustand (Client State)
- **Purpose**: Simple client-side state
- **Store**: `userStore`
  - `currentStatus` - Currently selected status (UI state)

**Design Decision**: Minimal client state. Most state comes from server via React Query.

### API Client Architecture

**Location**: `lib/api.ts`

**Pattern**: Custom hook `useApi()` that:
1. Gets auth token from Clerk
2. Makes authenticated requests to backend
3. Handles errors consistently

**Endpoints**:
- All endpoints require authentication (Bearer token)
- Base URL from `EXPO_PUBLIC_API_URL` env variable
- Automatic token injection in headers

### Authentication Flow

1. **Sign In Screen**: User enters email
2. **Clerk**: Sends verification code via email
3. **Verification**: User enters code
4. **Session**: Clerk creates session, stores token securely
5. **Navigation**: Redirects to `/(tabs)`
6. **API Calls**: Token automatically included in requests

**Token Storage**: Uses `expo-secure-store` for secure token caching (via `tokenCache.ts`)

### Deep Linking

**Configuration**: `app.json`

- **Scheme**: `socialavailability://`
- **Invite URLs**: `socialavailability://invite/[code]`
- **Web Fallback**: `https://yourapp.com/invite/[code]`

**Flow**:
1. User receives invite link
2. Opens link on device
3. App opens to `/invite/[code]` screen
4. User can accept invite (requires auth)

---

## Data Flow

### Creating a Status

```
User Input (Profile Screen)
    ↓
StatusPicker + TimeWindowPicker
    ↓
createStatus Mutation (React Query)
    ↓
API Client (lib/api.ts)
    ↓
POST /status (Backend)
    ↓
AuthGuard (validates token)
    ↓
StatusController
    ↓
StatusService
    ↓
Prisma → PostgreSQL
    ↓
Response → React Query Cache
    ↓
UI Updates (automatic)
```

### Viewing Contacts' Statuses

```
Home Screen Mounts
    ↓
useQuery('contacts') + useQuery('contacts-statuses')
    ↓
API Client (parallel requests)
    ↓
GET /contacts + GET /status/contacts
    ↓
Backend Services
    ↓
Database Queries
    ↓
Response (merged in component)
    ↓
ContactListItem renders with status
    ↓
Auto-refresh every 10 seconds
```

### Adding a Contact via Invite

```
User A: Generate Invite
    ↓
POST /invites/generate
    ↓
Backend creates Invite record
    ↓
Returns invite URL
    ↓
User A shares URL
    ↓
User B opens URL (deep link)
    ↓
GET /invites/:code (public)
    ↓
User B signs in
    ↓
POST /invites/:code/use
    ↓
Backend creates bidirectional Contact records
    ↓
Both users can now see each other
```

---

## Key Design Decisions

### 1. Bidirectional Contacts
**Decision**: When User A adds User B, both relationships are created automatically.

**Rationale**: Ensures both users can see each other's status without requiring mutual acceptance. Simplifies the UX.

### 2. Time-Windowed Statuses
**Decision**: Statuses have `startTime` and `endTime`. Only active statuses are shown.

**Rationale**: Allows users to set future availability. Statuses automatically expire.

### 3. Public Invite Viewing
**Decision**: `GET /invites/:code` is public (no auth required).

**Rationale**: Enables deep linking from mobile apps before user is authenticated.

### 4. Status Polling
**Decision**: Contacts list polls for status updates every 10 seconds.

**Rationale**: Simple real-time updates without WebSocket complexity. Good enough for MVP.

### 5. Minimal Styling
**Decision**: Basic layout with minimal styling as per requirements.

**Rationale**: Focus on functionality first. Styling can be enhanced later.

### 6. Prisma 5.x Instead of 7.x
**Decision**: Use Prisma 5.19.0 for Node.js 20.3.0 compatibility.

**Rationale**: Prisma 7 requires Node.js 20.19+. Downgrade allows development on current Node version.

### 7. React 19.1.0 with --legacy-peer-deps
**Decision**: Use Expo's preferred React version with legacy peer deps for Clerk.

**Rationale**: Balances Expo compatibility with Clerk requirements.

---

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/social_availability
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:3000
```

### Mobile App (.env)
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_APP_SCHEME=socialavailability
```

**Note**: For physical devices, replace `localhost` with your computer's local IP address.

---

## Security Considerations

1. **Authentication**: All protected routes require valid Clerk JWT tokens
2. **Token Storage**: Mobile app uses `expo-secure-store` for secure token caching
3. **Input Validation**: Backend uses `class-validator` for DTO validation
4. **SQL Injection**: Prisma ORM prevents SQL injection
5. **CORS**: Should be configured for production (not set in MVP)

---

## Future Enhancements

1. **Real-time Updates**: Replace polling with WebSockets or Server-Sent Events
2. **Push Notifications**: Notify users when contacts change status
3. **Time Picker**: Replace simplified time display with proper picker component
4. **Status History**: Show past statuses and patterns
5. **Groups**: Allow users to create contact groups
6. **Status Templates**: Save common status configurations
7. **Calendar Integration**: Sync with device calendar
8. **Offline Support**: Cache data for offline viewing

---

## Development Workflow

### Backend
```bash
cd backend
npm run start:dev  # Watch mode with hot reload
```

### Mobile App
```bash
cd mobile-app
npx expo start     # Start Expo dev server
```

### Database Migrations
```bash
cd backend
npx prisma migrate dev --name migration_name
npx prisma generate  # Regenerate Prisma Client
```

---

## Testing Strategy

**Current State**: MVP - No tests implemented

**Recommended**:
- **Backend**: Unit tests for services, E2E tests for controllers
- **Mobile**: Component tests with React Native Testing Library
- **Integration**: API integration tests

---

## Deployment Considerations

### Backend
- Deploy to Node.js hosting (e.g., Railway, Render, Heroku)
- Set up PostgreSQL database (managed service recommended)
- Configure environment variables
- Set up Clerk webhooks for user sync

### Mobile App
- Build with EAS (Expo Application Services)
- Configure deep linking for production domain
- Set up app store listings (iOS App Store, Google Play)

---

## Troubleshooting

### Common Issues

1. **Prisma Client not found**: Run `npx prisma generate`
2. **TypeScript errors**: Ensure Prisma Client is generated
3. **Auth errors**: Verify Clerk keys in `.env` files
4. **Network errors**: Check `EXPO_PUBLIC_API_URL` (use IP for physical devices)
5. **Version conflicts**: Use `--legacy-peer-deps` for npm installs

---

## References

- [NestJS Documentation](https://docs.nestjs.com/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)

