# Social Availability App

A minimal MVP mobile app where users can share their social availability status (Available/Questionable/Unavailable) with their contacts. Users can set time windows for their availability and see their contacts' statuses in a simple list.

## Project Structure

```
plaza/
├── backend/          # NestJS backend API
├── mobile-app/       # Expo React Native mobile app
└── SPEC.MD          # Project specification
```

## Prerequisites

- Node.js 20.19+ (for Prisma compatibility)
- PostgreSQL database
- Clerk account for authentication
- Expo CLI (install with `npm install -g expo-cli`)

## Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the `backend` directory:
   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URL="postgresql://user:password@localhost:5432/social_availability?schema=public"
   CLERK_SECRET_KEY=sk_test_your_key_here
   CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
   APP_URL=http://localhost:3000
   ```

4. **Set up database:**
   - Create a PostgreSQL database named `social_availability`
   - Update the `DATABASE_URL` in `.env` with your database credentials
   - Run Prisma migrations:
     ```bash
     npx prisma migrate dev --name init
     ```

5. **Start the backend server:**
   ```bash
   npm run start:dev
   ```

The backend will run on `http://localhost:3000`

### Mobile App Setup

1. **Navigate to mobile app directory:**
   ```bash
   cd mobile-app
   ```

2. **Set up environment variables:**
   Create a `.env` file in the `mobile-app` directory:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:3000
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   EXPO_PUBLIC_APP_SCHEME=socialavailability
   ```

3. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

4. **Run on device:**
   - Scan the QR code with the Expo Go app (iOS) or Camera app (Android)
   - Or press `i` for iOS simulator, `a` for Android emulator

## Features

✅ User authentication (Clerk)
✅ Contact list with status indicators
✅ Three-state status system (red/yellow/green)
✅ Time-based availability windows
✅ Status messages per contact
✅ Invite system with deep links
✅ Pull-to-refresh and polling

## API Endpoints

### Status
- `POST /status` - Create a new status
- `GET /status/me` - Get current user's status
- `GET /status/contacts` - Get all contacts' current statuses

### Contacts
- `GET /contacts` - Get user's contacts
- `POST /contacts` - Add a contact
- `GET /contacts/pending` - Get pending contact invitations
- `POST /contacts/:id/accept` - Accept a contact invitation

### Invites
- `POST /invites/generate` - Generate an invite code
- `GET /invites/:code` - Get invite details (public)
- `POST /invites/:code/use` - Use an invite code to add contact

## Database Schema

The app uses Prisma with PostgreSQL. Key models:
- **User** - User accounts linked to Clerk
- **Contact** - Bidirectional contact relationships
- **Status** - Availability statuses with time windows
- **Invite** - Invite codes for adding contacts

## Notes

- The app uses minimal styling as requested - just functional components with basic layout
- Deep linking is configured for invite URLs
- Status polling happens every 10 seconds on the contacts list
- The time picker is simplified for MVP - can be enhanced later

## Troubleshooting

### Prisma Issues
If you get Node.js version errors with Prisma, ensure you're using Node.js 20.19+ or 22.12+.

### Clerk Authentication
Make sure your Clerk keys are correctly set in both backend and mobile app `.env` files.

### Database Connection
Ensure PostgreSQL is running and the `DATABASE_URL` in backend `.env` is correct.

### Mobile App Connection
For physical devices, replace `localhost` in `EXPO_PUBLIC_API_URL` with your computer's local IP address (e.g., `http://192.168.1.100:3000`).

