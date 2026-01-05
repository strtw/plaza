# Testing on iPhone with Expo Go - Step by Step Guide

## Prerequisites

1. ✅ iPhone and computer on the **same Wi-Fi network**
2. ✅ Expo Go app installed on iPhone (free from App Store)
3. ✅ Expo dev server running on your computer

## Step-by-Step Instructions

### Step 1: Install Expo Go on iPhone

1. Open the **App Store** on your iPhone
2. Search for **"Expo Go"**
3. Install the app (it's free, made by Expo)
4. Open the Expo Go app

### Step 2: Start Expo Dev Server

On your computer, in the terminal:

```bash
cd mobile-app
npx expo start
```

You should see:
- A QR code in the terminal
- Options like: `› Press i │ open iOS simulator`
- Your local IP address (e.g., `exp://192.168.2.182:8081`)

### Step 3: Connect iPhone to Expo

**Option A: Scan QR Code (Easiest)**

1. In the Expo Go app on your iPhone, tap **"Scan QR Code"**
2. Point your iPhone camera at the QR code in your terminal
3. Tap the notification that appears
4. The app should load in Expo Go

**Option B: Enter URL Manually (If QR doesn't work)**

1. In Expo Go app, tap **"Enter URL manually"** (at the bottom)
2. Look at your terminal for the URL (format: `exp://192.168.2.182:8081`)
3. Type or paste the URL
4. Tap "Connect"

**Option C: Use Tunnel Mode (If same Wi-Fi doesn't work)**

1. In your terminal, press `s` to switch connection type
2. Select **"tunnel"** (slower but works across networks)
3. A new QR code will appear
4. Scan it with Expo Go

### Step 4: Wait for App to Load

- First time may take 30-60 seconds
- You'll see "Downloading JavaScript bundle..."
- Then the app will load

### Step 5: Test the App

Once loaded, you should see:
- Sign-in screen
- Try signing up or signing in
- Test creating a status
- Test viewing contacts

## Troubleshooting

### "No usable data found" when scanning QR code
- **Solution**: Use Expo Go app, not the Camera app
- Make sure you're in Expo Go's "Scan QR Code" feature

### "Unable to connect to server"
- **Check**: iPhone and computer on same Wi-Fi?
- **Try**: Tunnel mode (press `s` in Expo terminal, select "tunnel")
- **Check**: Firewall blocking port 8081?

### App loads but shows errors
- **Check**: Railway backend is online (green dot in Railway dashboard)
- **Check**: `EXPO_PUBLIC_API_URL` in `mobile-app/.env` is correct
- **Check**: Console logs in Expo Go (shake device → "Show Dev Menu" → "Show Element Inspector")

### Can't find QR code in terminal
- Make sure terminal window is wide enough
- Try zooming out (Cmd + -)
- Or use manual URL entry method

## Quick Reference

**In Expo terminal, you can:**
- `i` - Open iOS Simulator (Mac only)
- `a` - Open Android Emulator
- `w` - Open in web browser
- `s` - Switch connection type (LAN/tunnel)
- `r` - Reload app
- `m` - Toggle menu

**On iPhone (in Expo Go):**
- Shake device → Opens developer menu
- Can reload, show inspector, etc.

## Network Requirements

- **Same Wi-Fi**: iPhone and computer must be on same network
- **Port 8081**: Must not be blocked by firewall
- **No VPN**: VPNs can interfere with local network connections

## Alternative: Use iOS Simulator (Mac only)

If you have a Mac, this is often easier:

1. In Expo terminal, just press **`i`**
2. iOS Simulator opens automatically
3. App loads (no QR code needed)
4. Works like a real iPhone

## Success Indicators

✅ Expo Go app opens your app
✅ Sign-in screen appears
✅ Can interact with the app
✅ No connection errors in console

You're all set! 🎉

