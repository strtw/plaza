# Cloud Services Setup Guide

This guide walks you through setting up the required cloud service accounts for the Social Availability App.

## Required Accounts

### 1. Clerk (Authentication) ⚠️ **REQUIRED**

**What it is**: Authentication service that handles user sign-in, email verification, and JWT tokens.

**Why you need it**: The app uses Clerk for all user authentication. Without it, users cannot sign in.

**Setup Steps**:

1. **Create Account**
   - Go to [https://clerk.com](https://clerk.com)
   - Click "Sign Up" (free tier available)
   - Create an account with email or GitHub

2. **Create Application**
   - After signing in, click "Create Application"
   - Choose a name (e.g., "Social Availability App")
   - Select authentication methods:
     - ✅ Email (required - this is what the app uses)
     - Optional: Social logins (Google, GitHub, etc.)

3. **Get Your Keys**
   - In your Clerk dashboard, go to **API Keys**
   - You'll see two keys:
     - **Publishable Key** (starts with `pk_test_...`) - Used in mobile app
     - **Secret Key** (starts with `sk_test_...`) - Used in backend
   
4. **Get Webhook Secret** (Optional for MVP, but recommended)
   - Go to **Webhooks** in Clerk dashboard
   - Create a webhook endpoint (for future user sync)
   - Copy the **Signing Secret** (starts with `whsec_...`)

5. **Update Environment Variables**

   **Backend** (`backend/.env`):
   ```env
   CLERK_SECRET_KEY=sk_test_your_actual_key_here
   CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

   **Mobile App** (`mobile-app/.env`):
   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
   ```

**Free Tier**: Clerk offers a generous free tier with:
- 10,000 monthly active users
- Unlimited sessions
- Email authentication
- Perfect for development and MVP

---

### 2. PostgreSQL Database ⚠️ **REQUIRED**

**What it is**: The database that stores all app data (users, contacts, statuses, invites).

**Options**:

#### Option A: Local PostgreSQL (Free, for Development)

1. **Install PostgreSQL**
   - **macOS**: `brew install postgresql@14` or download from [postgresql.org](https://www.postgresql.org/download/)
   - **Windows**: Download installer from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **Linux**: `sudo apt-get install postgresql` (Ubuntu/Debian)

2. **Create Database**
   ```bash
   # Start PostgreSQL service
   # macOS: brew services start postgresql@14
   # Linux: sudo systemctl start postgresql
   
   # Connect to PostgreSQL
   psql postgres
   
   # Create database
   CREATE DATABASE social_availability;
   
   # Create user (optional, or use default postgres user)
   CREATE USER your_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE social_availability TO your_user;
   ```

3. **Update Backend `.env`**
   ```env
   DATABASE_URL="postgresql://your_user:your_password@localhost:5432/social_availability?schema=public"
   ```

#### Option B: Cloud PostgreSQL (Recommended for Production)

**Popular Options**:

1. **Supabase** (Free tier available)
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up (free tier: 500MB database, 2GB bandwidth)
   - Create new project
   - Go to **Settings** → **Database**
   - Copy the **Connection string** (URI format)
   - Update `DATABASE_URL` in `backend/.env`

2. **Neon** (Free tier available)
   - Go to [https://neon.tech](https://neon.tech)
   - Sign up (free tier: 0.5GB storage)
   - Create new project
   - Copy connection string
   - Update `DATABASE_URL` in `backend/.env`

3. **Railway** (Free tier available)
   - Go to [https://railway.app](https://railway.app)
   - Sign up with GitHub
   - Create new project → Add PostgreSQL
   - Copy connection string
   - Update `DATABASE_URL` in `backend/.env`

4. **Render** (Free tier available)
   - Go to [https://render.com](https://render.com)
   - Sign up
   - Create new PostgreSQL database
   - Copy connection string
   - Update `DATABASE_URL` in `backend/.env`

**After Setting Up Database**:
```bash
cd backend
npx prisma migrate dev --name init
```

---

### 3. Expo Account (Optional for Development)

**What it is**: Expo's service for building and deploying React Native apps.

**Why it's optional**: 
- You can develop locally without an account
- Only needed for:
  - Building production apps
  - Using EAS (Expo Application Services)
  - Publishing to app stores

**Setup Steps** (if needed):

1. **Create Account**
   - Go to [https://expo.dev](https://expo.dev)
   - Sign up (free)
   - Verify email

2. **Login in CLI** (when needed)
   ```bash
   npx expo login
   ```

**Note**: For local development with `npx expo start`, you don't need an account. The QR code will work with the Expo Go app on your phone.

---

## Quick Setup Checklist

- [ ] Create Clerk account and application
- [ ] Copy Clerk keys to `.env` files
- [ ] Set up PostgreSQL (local or cloud)
- [ ] Update `DATABASE_URL` in `backend/.env`
- [ ] Run Prisma migrations: `cd backend && npx prisma migrate dev --name init`
- [ ] (Optional) Create Expo account for production builds

---

## Environment Variables Summary

### Backend (`backend/.env`)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://user:password@host:5432/social_availability?schema=public"
CLERK_SECRET_KEY=sk_test_...          # From Clerk dashboard
CLERK_WEBHOOK_SECRET=whsec_...        # From Clerk webhooks (optional)
APP_URL=http://localhost:3000
```

### Mobile App (`mobile-app/.env`)
```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  # From Clerk dashboard
EXPO_PUBLIC_APP_SCHEME=socialavailability
```

**Important**: 
- For physical devices, replace `localhost` with your computer's local IP (e.g., `http://192.168.1.100:3000`)
- Find your IP: `ifconfig` (macOS/Linux) or `ipconfig` (Windows)

---

## Cost Summary

| Service | Free Tier | Paid Plans Start At |
|---------|-----------|---------------------|
| **Clerk** | 10,000 MAU/month | $25/month |
| **Supabase** | 500MB database | $25/month |
| **Neon** | 0.5GB storage | $19/month |
| **Railway** | $5 credit/month | $5/month |
| **Render** | 90 days free | $7/month |
| **Expo** | Free for development | Free (pay for builds) |

**For MVP/Development**: All services can be used for free! 🎉

---

## Troubleshooting

### Clerk Issues
- **"Invalid token"**: Check that `CLERK_SECRET_KEY` matches your backend key
- **"Publishable key not found"**: Verify `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in mobile app `.env`
- **Keys not working**: Make sure you're using keys from the same Clerk application

### Database Issues
- **Connection refused**: Ensure PostgreSQL is running
- **Authentication failed**: Check username/password in `DATABASE_URL`
- **Database doesn't exist**: Run `CREATE DATABASE social_availability;` in PostgreSQL

### Mobile App Connection
- **Can't connect to backend**: 
  - Use local IP instead of `localhost` for physical devices
  - Check that backend is running on correct port
  - Verify `EXPO_PUBLIC_API_URL` is correct

---

## Next Steps

After setting up accounts:

1. ✅ Fill in all `.env` files with your keys
2. ✅ Run database migrations: `cd backend && npx prisma migrate dev --name init`
3. ✅ Start backend: `cd backend && npm run start:dev`
4. ✅ Start mobile app: `cd mobile-app && npx expo start`
5. ✅ Test sign-in flow in the mobile app

You're ready to develop! 🚀

