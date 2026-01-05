# Next Steps After Successful Railway Deployment 🎉

## ✅ What's Done
- Backend deployed successfully on Railway
- PostgreSQL database connected
- Environment variables configured

## 🔧 What to Do Now

### 1. Get Your Railway Backend URL

In Railway dashboard:
- Click on **plaza** service
- Go to **"Settings"** tab
- Find **"Domains"** or look for the public URL
- Copy the URL (format: `https://plaza-production-xxxx.up.railway.app`)

### 2. Update Mobile App to Use Railway URL

Edit `mobile-app/.env` and change:

```env
# Change this:
EXPO_PUBLIC_API_URL=http://localhost:3000

# To your Railway URL:
EXPO_PUBLIC_API_URL=https://your-railway-url.up.railway.app
```

**Keep the rest the same:**
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_d2FudGVkLXJvb3N0ZXItODIuY2xlcmsuYWNjb3VudHMuZGV2JA
EXPO_PUBLIC_APP_SCHEME=socialavailability
```

### 3. Test the Mobile App

```bash
cd mobile-app
npx expo start
```

Then:
- Scan QR code with Expo Go app
- Try signing in
- Test creating a status
- Test viewing contacts

### 4. (Optional) Set Up Local Development

If you want to develop locally, create `backend/.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/social_availability?schema=public"
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
APP_URL=http://localhost:3000
```

Then:
```bash
cd backend
npx prisma migrate dev --name init
npm run start:dev
```

## 🧪 Testing Checklist

- [ ] Mobile app connects to Railway backend
- [ ] Sign-in works
- [ ] Can create status
- [ ] Can view contacts (after adding some)
- [ ] Can generate invite links

## 🐛 Troubleshooting

### Mobile app can't connect to backend
- Check `EXPO_PUBLIC_API_URL` is correct
- Make sure Railway service is "Online" (green dot)
- Check Railway logs for errors

### Authentication errors
- Verify `CLERK_SECRET_KEY` in Railway matches Clerk dashboard
- Check mobile app has correct `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Database errors
- Check Railway logs for migration errors
- Verify `DATABASE_URL` is correctly linked to Postgres service

## 🚀 You're Ready!

Your app is now live on Railway! The mobile app can connect to it from anywhere.

