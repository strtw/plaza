# Railway PostgreSQL Setup Guide

## Step-by-Step Instructions

### 1. Add PostgreSQL Service

1. **In your Railway project dashboard:**
   - You should see your project (plaza) with your backend service
   - Click the **"+ New"** button (usually in the top right or bottom of the service list)

2. **Select Database:**
   - Choose **"Database"** from the dropdown menu
   - Select **"Add PostgreSQL"**

3. **PostgreSQL Service Created:**
   - Railway will automatically create a PostgreSQL database
   - You'll see a new service appear in your project (usually named "Postgres" or "PostgreSQL")

### 2. Get the Connection String

1. **Click on the PostgreSQL service** you just created

2. **Go to the "Variables" tab:**
   - You'll see environment variables automatically created
   - Look for `DATABASE_URL` or `POSTGRES_URL`
   - The format will be: `postgresql://postgres:password@hostname:port/railway`

3. **Copy the connection string:**
   - Click the copy icon next to `DATABASE_URL`
   - Or manually copy the value

### 3. Add Database URL to Backend Service

1. **Go back to your backend service** (the NestJS app)

2. **Click on the "Variables" tab**

3. **Add the DATABASE_URL:**
   - Click **"+ New Variable"**
   - Name: `DATABASE_URL`
   - Value: Paste the connection string from the PostgreSQL service
   - Click **"Add"**

### 4. Add Other Required Environment Variables

While you're in the Variables tab, also add:

- `NODE_ENV` = `production`
- `CLERK_SECRET_KEY` = `sk_test_your_key_here` (from Clerk dashboard)
- `CLERK_WEBHOOK_SECRET` = `whsec_your_secret_here` (optional, from Clerk)
- `APP_URL` = `https://your-app-name.railway.app` (Railway will provide this URL)

**Note:** Railway automatically sets `PORT`, so you don't need to set it manually.

### 5. Configure Root Directory (Important!)

1. **In your backend service settings:**
   - Click on your backend service
   - Go to **"Settings"** tab
   - Find **"Root Directory"** or **"Working Directory"**
   - Set it to: `backend`
   - This tells Railway where your `package.json` is located

### 6. Run Database Migrations

After the database is set up, you need to run Prisma migrations. You have two options:

#### Option A: Run migrations via Railway CLI (Recommended)

```bash
# Install Railway CLI (if not already installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
cd backend
railway run npx prisma migrate deploy
```

#### Option B: Add migration to build process

Update your `railway.json` to include migrations in the build:

```json
{
  "build": {
    "buildCommand": "cd backend && npm install && npm run build && npx prisma generate && npx prisma migrate deploy"
  }
}
```

### 7. Verify Database Connection

After deployment, check the logs to ensure:
- Database connection is successful
- Migrations ran successfully
- No connection errors

## Quick Checklist

- [ ] Added PostgreSQL service in Railway
- [ ] Copied `DATABASE_URL` from PostgreSQL service
- [ ] Added `DATABASE_URL` to backend service variables
- [ ] Added other environment variables (CLERK_SECRET_KEY, etc.)
- [ ] Set root directory to `backend` in backend service settings
- [ ] Ran Prisma migrations
- [ ] Verified deployment logs show successful database connection

## Troubleshooting

### Database Connection Errors

- **"Connection refused"**: Make sure the PostgreSQL service is running (green status)
- **"Authentication failed"**: Verify the `DATABASE_URL` is correct
- **"Database does not exist"**: Run migrations: `npx prisma migrate deploy`

### Migration Errors

- **"No migrations found"**: Make sure you're in the `backend` directory
- **"Prisma Client not generated"**: Run `npx prisma generate` first

### Build Errors

- **"Cannot find module"**: Make sure root directory is set to `backend`
- **"Package.json not found"**: Verify root directory setting

## Next Steps

After PostgreSQL is set up:

1. ✅ Database is ready
2. ✅ Run migrations
3. ✅ Backend should deploy successfully
4. ✅ Update mobile app `.env` with Railway URL (instead of localhost)
5. ✅ Test the full app!

