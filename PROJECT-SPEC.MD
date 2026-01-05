SPEC.MD

# Mobile App Tech Stack Specification
## Lean Team Edition (2-3 Developers)

## Project Overview
Production-ready mobile application (iOS & Android) with geolocation, user status, mapping, and scheduling capabilities. Optimized for small teams that want to move fast without accumulating tech debt.

**Philosophy: Start lean, scale smart.**

---

## Frontend Stack

### Core Framework
- **React Native** (latest stable)
- **Expo SDK 52+** (managed workflow)
- **TypeScript** (strict mode enabled)
- **Expo Router** for file-based routing

### UI & Styling
- **NativeWind** (Tailwind CSS for React Native) - consistent styling with minimal code
- **Expo Vector Icons** for iconography
- **React Native Safe Area Context** for device-safe layouts
- ~~React Native Reanimated~~ → Add later when you need complex animations

### State Management
- **Zustand** - lightweight, scalable, minimal boilerplate
  - Better than Context (no re-render issues)
  - Simpler than Redux (10x less code)
  - Scales from 1 to 100 stores easily
- **React Query (TanStack Query)** - server state management, caching, automatic refetching
  - Eliminates most manual state management
  - Handles loading/error states automatically
  - Background sync out of the box

### Key Libraries

**Geolocation & Maps:**
- `expo-location` - geolocation with background support
- `react-native-maps` - maps with full customization

**Scheduling & Calendar:**
- `react-native-calendars` - calendar UI components
- `date-fns` - date manipulation (lightweight, tree-shakeable)
- `expo-calendar` - device calendar integration

**Authentication & Storage:**
- `@clerk/clerk-expo` - authentication (saves weeks of custom auth work)
- `expo-secure-store` - encrypted local storage
- `@react-native-async-storage/async-storage` - persistent storage

**Forms & Validation:**
- `react-hook-form` - performant form handling
- `zod` - TypeScript-first schema validation

**Navigation:**
- Expo Router (built on React Navigation v6)

---

## Backend Stack

### Runtime & Framework
- **Node.js 20 LTS**
- **Nest.js** - TypeScript framework with built-in architecture
  - YES, it's more than Express, but it prevents spaghetti code
  - Built-in structure = less bike-shedding about folder organization
  - Auto-generated API docs with Swagger
  - Built-in validation, testing, dependency injection
  - Worth the learning curve even for small teams

### Database
- **PostgreSQL 16** - primary database
- **PostGIS extension** - geospatial queries and indexing (critical for location features)
- **Prisma** - type-safe ORM
  - Auto-generates TypeScript types from schema
  - Safe database migrations
  - Excellent dev experience with Prisma Studio

### For Later (Not MVP)
- ~~Redis~~ → Add when you need caching or session storage
- ~~Socket.io~~ → Add when you need real-time features
- ~~Job queues~~ → Add when you have background tasks
- ~~File storage~~ → Add when users upload photos/files

---

## Authentication & Security

### Authentication Provider
- **Clerk** - modern auth platform (worth every penny)
  - Social login, email/password, magic links out of the box
  - User management dashboard (saves building admin panel)
  - Excellent React Native SDK
  - JWT-based, secure by default
  - **Saves 2-4 weeks** of auth development

### Security Measures
- **CORS** properly configured (Nest.js built-in)
- **Rate limiting** (Nest.js throttler)
- Environment variables (never commit secrets)
- HTTPS enforced in production (Railway handles this)

---

## DevOps & Infrastructure

### Hosting
- **Railway** - all-in-one platform
  - Node.js backend
  - PostgreSQL with PostGIS
  - Redis (when you need it)
  - One-command deployments
  - Fair pricing that scales
  - Built-in monitoring and logs

**Why Railway for lean teams:**
- No DevOps expertise required
- Git push = automatic deployment
- Database backups included
- SSL certificates automatic
- Scales with your growth

### Mobile App Distribution
- **Expo Go** for development (scan QR code, instant preview)
- **EAS Build** when ready for app stores
- **EAS Submit** for automated app store submissions
- **EAS Update** for over-the-air JavaScript updates (skip app review for bug fixes)

### Version Control
- **Git** with GitHub
- Feature branches
- Direct to main is fine with 2-3 devs (add PR reviews later)

---

## Development Tools

### Code Editor
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - React Native Tools
  - Prisma

### API Testing
- **Thunder Client** (VS Code extension) - simpler than Postman

### Code Quality (Minimal Setup)
- **TypeScript strict mode** - catches bugs at compile time
- **ESLint** with TypeScript rules
- **Prettier** for formatting
- That's it for now - don't over-engineer

---

## Third-Party Services (MVP)

### Maps & Geolocation
- **Google Maps Platform**
  - $200 free credit per month
  - More than enough for early development

### Push Notifications
- ~~Not needed for MVP~~ → Add later when you need to notify users

### Email
- ~~Not needed for MVP~~ → Add Resend later when you send transactional emails

---

## Environment Configuration

### Mobile App (.env)
```
EXPO_PUBLIC_API_URL=http://localhost:3000  # dev
EXPO_PUBLIC_API_URL=https://api.yourapp.com  # production
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza_xxx
```

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
CLERK_SECRET_KEY=sk_test_xxx
GOOGLE_MAPS_API_KEY=AIza_xxx
```

---

## Project Structure

### Mobile App
```
/app                  # Expo Router screens
  /(tabs)            # Tab navigation
    /index.tsx       # Home/map screen
    /schedule.tsx    # Schedule screen
    /profile.tsx     # Profile screen
  /login.tsx         # Login screen
/components          # Reusable components
  /LocationPicker.tsx
  /StatusSelector.tsx
  /ScheduleItem.tsx
/hooks               # Custom hooks
  /useLocation.ts
  /useUserStatus.ts
/lib                 # Utilities
  /api.ts           # API client (axios/fetch wrapper)
  /types.ts         # Shared types
/stores              # Zustand stores
  /userStore.ts     # User state
  /locationStore.ts # Location state
/constants           # Constants
  /colors.ts
  /config.ts
```

### Backend
```
/src
  /modules           # Feature modules
    /users
      /users.controller.ts
      /users.service.ts
      /users.module.ts
      /dto             # Data transfer objects
    /locations
    /status
    /scheduling
  /common
    /guards          # Auth guards
    /decorators
  /config            # Configuration
  /prisma
    /schema.prisma   # Database schema
    /migrations      # Migration history
```

---

## Getting Started (First Day Commands)

```bash
# Create mobile app
npx create-expo-app@latest mobile-app -e with-router

# Install core dependencies
cd mobile-app
npx expo install expo-location react-native-maps
npm install zustand @tanstack/react-query @clerk/clerk-expo
npm install nativewind
npm install tailwindcss --save-dev

# Create backend
npx @nestjs/cli new backend
cd backend
npm install @prisma/client
npm install -D prisma
npx prisma init

# Set up Clerk (sign up at clerk.com)
# Get your API keys and add to .env files

# Run mobile app
cd mobile-app
npx expo start
# Scan QR code with phone

# Run backend
cd backend
npm run start:dev
```

---

## Lean Development Workflow

### Day-to-Day Development
1. Run backend: `npm run start:dev` (auto-reloads)
2. Run mobile: `npx expo start` (scan QR code)
3. Make changes, see them instantly
4. Commit frequently to main (it's just 2-3 devs)

### Database Changes
1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Prisma auto-generates TypeScript types
4. Use new types in your code immediately

### Deploying
1. Push to GitHub main branch
2. Railway auto-deploys backend
3. For mobile: `npx eas build` when ready for app stores

---

## Cost Breakdown (Lean Team)

### Development Phase (0-100 users)
- **Railway:** $5/month (hobby plan)
- **Clerk:** $0 (free tier up to 10k MAU)
- **Google Maps:** $0 (free $200 credit)
- **Total: $5/month** 🎉

### Early Growth (100-1,000 users)
- **Railway:** $20-50/month
- **Clerk:** $0 (still under 10k)
- **Google Maps:** $20-50/month
- **Total: $40-100/month**

### Product-Market Fit (1,000-10,000 users)
- **Railway:** $100-200/month
- **Clerk:** $25/month
- **Google Maps:** $100-200/month
- **Total: $225-425/month**

---

## Why These Specific Choices?

**Zustand over Context/Redux:**
- Context: Re-render hell, doesn't scale
- Redux: Too much boilerplate for small teams
- Zustand: Perfect middle ground, grows with you

**Nest.js over Express:**
- Express: Freedom = chaos with 3 devs
- Nest.js: Structure = consistency without debate
- Auto-generated API docs save hours
- Built-in testing utilities

**Clerk over Custom Auth:**
- Custom: 2-4 weeks of development
- Firebase Auth: Lock-in, React Native SDK is clunky
- Clerk: Perfect DX, costs $25/month at scale
- ROI: Pay $25 vs. spending $5,000 in dev time

**Railway over AWS/Vercel:**
- AWS: Requires DevOps knowledge
- Vercel: Great for frontend, backend is expensive
- Railway: Backend + Database + Redis in one place
- Git push = deployed (no YAML files)

**Prisma over Raw SQL/TypeORM:**
- Raw SQL: Typos cause production bugs
- TypeORM: Okay but TypeScript support is meh
- Prisma: Auto-generated types, safe migrations
- Prisma Studio: Built-in database GUI

---

## What NOT to Do (Common Mistakes)

❌ **Don't** add microservices - you're 2-3 devs, one backend is plenty
❌ **Don't** build custom auth - use Clerk and ship features instead  
❌ **Don't** optimize prematurely - profile first, optimize later
❌ **Don't** write tests for everything - test critical paths only
❌ **Don't** use GraphQL yet - REST is simpler, add GraphQL if you need it
❌ **Don't** containerize everything - Railway handles deployment
❌ **Don't** build an admin dashboard - Clerk has user management built-in

✅ **Do** ship features
✅ **Do** talk to users
✅ **Do** iterate quickly
✅ **Do** add complexity only when needed

---

## What to Add Later (And When)

### 📊 **Analytics & Monitoring** → Add at 100+ active users

**What:**
- Sentry for error tracking
- PostHog for product analytics

**Why not now:**
- Console logs work fine for debugging with <100 users
- You're iterating too fast for analytics to matter
- Cost: $0 → $50+/month

**When to add:**
- You have consistent daily users
- You need to understand feature usage
- Bugs are hard to reproduce from user reports

**Effort:** 2-3 hours to integrate

---

### 🔄 **Real-time Features** → Add when users ask for live updates

**What:**
- Socket.io for WebSocket connections
- Redis for pub/sub messaging

**Why not now:**
- Polling every 10 seconds works fine initially
- Real-time adds complexity to testing and debugging
- Most features don't need real-time

**When to add:**
- Users complain about delays in status updates
- You're building collaborative features
- Polling creates too much load

**Effort:** 1-2 days to implement properly

---

### 🔔 **Push Notifications** → Add when you need to re-engage users

**What:**
- Firebase Cloud Messaging via Expo
- Notification scheduling system

**Why not now:**
- Users are checking the app anyway (early adopters)
- Requires device permissions (UX friction)
- Need notification strategy first

**When to add:**
- You have retention problems (users forget to check app)
- Time-sensitive features (meeting reminders)
- You have 500+ users

**Effort:** 3-4 days (permissions, backend, testing)

---

### 📧 **Email Service** → Add when you send transactional emails

**What:**
- Resend for email delivery
- Email templates

**Why not now:**
- Clerk handles auth emails
- You don't need marketing emails yet
- Cost: $0 → $20/month

**When to add:**
- Sending password resets (Clerk handles this)
- Sending notifications (push notifications first)
- Sending reports or summaries to users

**Effort:** 1 day for setup + templates

---

### 🗂️ **File Storage** → Add when users upload images/files

**What:**
- AWS S3 for file storage
- Image optimization pipeline

**Why not now:**
- No file upload features yet
- Adds complexity (permissions, URLs, cleanup)
- Cost: $5-20/month

**When to add:**
- Users want to upload avatars
- Users want to attach photos to locations
- You need to store user-generated content

**Effort:** 2-3 days (upload flow, security, cleanup jobs)

---

### 🧪 **Comprehensive Testing** → Add when team grows beyond 3 devs

**What:**
- Full Jest test suite (70%+ coverage)
- E2E tests with Detox
- Pre-commit hooks with Husky

**Why not now:**
- Manual testing is faster with 2-3 devs
- Tests slow down rapid iteration
- You're changing features too fast

**When to add:**
- Team grows to 4+ developers
- Production bugs are costing users
- Features are stable enough to test

**Effort:** Ongoing - 20% of development time

---

### 🚀 **CI/CD Pipeline** → Add when manual deploys become painful

**What:**
- GitHub Actions for automated testing
- Automated deployments
- Staging environment

**Why not now:**
- Railway auto-deploys from main branch
- Manual EAS builds are fine for now
- You're deploying 1-2x per day max

**When to add:**
- Deploying 5+ times per day
- Multiple developers pushing simultaneously
- Need automated testing before deploy

**Effort:** 1-2 days to set up properly

---

### 🎨 **Advanced Animations** → Add when basic animations aren't enough

**What:**
- React Native Reanimated
- Complex gesture handlers
- Micro-interactions

**Why not now:**
- Basic transitions work fine
- Animations don't ship features
- Harder to debug

**When to add:**
- Users complain about "clunky" feel
- Competing apps have better animations
- You have design bandwidth

**Effort:** Ongoing - adds 20-30% to feature time

---

### 🔐 **Advanced Security** → Add at 1,000+ users

**What:**
- Helmet.js for HTTP headers
- Rate limiting per user
- Security audit
- Penetration testing

**Why not now:**
- Basic security is handled by Clerk + Railway
- Limited attack surface with <100 users
- Optimization is premature

**When to add:**
- Handling sensitive data beyond auth
- Getting security questions from enterprise customers
- 1,000+ users makes you a target

**Effort:** 1 week for audit + fixes

---

### 📱 **App Store Optimization** → Add at launch

**What:**
- EAS Build configuration
- App store screenshots
- Metadata optimization
- App review preparation

**Why not now:**
- Testing with Expo Go is faster
- Not ready for public yet
- Store submissions take 1-2 weeks

**When to add:**
- Ready for beta testers outside your team
- Ready for public launch
- Have 10+ beta users giving feedback

**Effort:** 3-5 days (first time), then 1-2 days per update

---

### 🌍 **Internationalization (i18n)** → Add if targeting multiple countries

**What:**
- react-i18next
- Translation management
- Locale-specific formatting

**Why not now:**
- English-only is simpler
- Translating too early wastes money (features change)
- Most early users speak English

**When to add:**
- 20%+ of users request other languages
- Expanding to non-English markets
- User growth plateaus in English markets

**Effort:** 1 week initial setup, 20% overhead per feature

---

### 🔎 **Full-Text Search** → Add when basic filtering isn't enough

**What:**
- PostgreSQL full-text search
- Or Algolia/Meilisearch
- Search indexing strategy

**Why not now:**
- Simple SQL LIKE queries work fine
- Limited data to search
- Users don't expect search yet

**When to add:**
- Users can't find what they're looking for
- 1,000+ records to search through
- Search is a core feature request

**Effort:** 3-5 days for full-text search, 1-2 weeks for external service

---

### 📊 **Admin Dashboard** → Add when you need internal tools

**What:**
- Admin web interface
- User management beyond Clerk
- Analytics dashboards
- Support tools

**Why not now:**
- Clerk has user management built-in
- Railway has database dashboard
- You can use Prisma Studio for database queries

**When to add:**
- Support team needs tools
- Manual database queries are too frequent
- Need custom analytics

**Effort:** 1-2 weeks for basic dashboard

---

### ⚡ **Performance Optimization** → Add when users complain or metrics show problems

**What:**
- Redis caching layer
- Database query optimization
- Image optimization
- Bundle size reduction
- Code splitting

**Why not now:**
- Premature optimization wastes time
- No performance problems yet
- Users don't notice issues at small scale

**When to add:**
- API responses >1 second
- App feels slow to users
- 1,000+ concurrent users
- Database queries >500ms

**Effort:** Ongoing - profile first, optimize second

---

### 🏗️ **Microservices** → Probably never needed

**What:**
- Splitting backend into multiple services
- Service mesh
- Event-driven architecture

**Why not now:**
- Massive complexity increase
- You're 2-3 developers
- Monolith can handle millions of users

**When to add:**
- Team is 15+ backend engineers
- Different services need to scale independently
- Hitting architectural limits of monolith (rare)

**Effort:** Months of work, ongoing maintenance nightmare

**Alternative:** Add more resources to your monolith, it's cheaper and simpler.

---

## Priority Matrix

### 🔴 **Add First** (at 100-500 users)
1. Error tracking (Sentry) - critical for debugging
2. Analytics (PostHog) - understand what users do
3. Push notifications - if retention is an issue

### 🟡 **Add Second** (at 500-2,000 users)
1. CI/CD pipeline - manual deploys get painful
2. Comprehensive testing - more developers joining
3. Performance optimization - as issues arise

### 🟢 **Add Eventually** (at 2,000+ users)
1. Real-time features - when polling doesn't scale
2. Advanced security - when you're a target
3. Admin dashboard - when support needs tools

### 🔵 **Maybe Never**
1. Microservices - unless team is 20+ engineers
2. GraphQL - unless clients demand it
3. Custom analytics - PostHog is usually enough

---

## The Golden Rule

**"Can we ship the core feature without this?"**

- If YES → Don't add it yet
- If NO → Add it now
- If MAYBE → Ship without it, add later if users complain

Focus on shipping features users want, not infrastructure you think you'll need.