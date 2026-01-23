# Local Database Setup

This guide explains how to use both the local Docker database and Railway database for development.

## Quick Start

### Using Local Docker Database (Default)
```bash
cd backend
npm run start:dev
```
This will:
- Automatically load `.env` file via NestJS ConfigModule
- Use `DATABASE_URL` from `.env` (should point to local Docker DB)
- Start the backend server connected to local database

**Make sure your `.env` file has:**
```env
DATABASE_URL=postgresql://plaza_user:plaza_dev_password@localhost:5432/plaza_dev?schema=public
```

### Using Railway Database (For Testing)
```bash
cd backend
DATABASE_URL=your_railway_public_url npm run start:dev
```

Or update `.env` temporarily to use Railway URL, then restart the server.

## Database Management

### Start Local Database
```bash
cd backend
./scripts/docker-db.sh start
```

### Stop Local Database
```bash
cd backend
./scripts/docker-db.sh stop
```

### Reset Local Database (⚠️ Deletes all data)
```bash
cd backend
./scripts/docker-db.sh reset
```

### Check Database Status
```bash
cd backend
./scripts/docker-db.sh status
```

### View Database Logs
```bash
cd backend
./scripts/docker-db.sh logs
```

## Running Migrations

### Test Migrations on Local Database
```bash
cd backend
./scripts/test-migration.sh
```

This will:
- Check if local database is running
- Generate Prisma client
- Deploy all migrations
- Show migration status

## Local Database Connection Details

**Connection String:**
```
postgresql://plaza_user:plaza_dev_password@localhost:5432/plaza_dev?schema=public
```

**Credentials:**
- User: `plaza_user`
- Password: `plaza_dev_password`
- Database: `plaza_dev`
- Port: `5432`

## Important Notes

1. **Same Clerk Credentials**: Both local and Railway databases use the same Clerk credentials from `.env`, so you can use the same Clerk account with both.

2. **Separate Data**: Local and Railway databases are completely separate - data in one doesn't affect the other.

3. **Migration Testing**: Use the local database to test migrations before deploying to Railway.

4. **Environment Variables**: The `.env` file should contain:
   - `DATABASE_URL` (Local Docker DB by default: `postgresql://plaza_user:plaza_dev_password@localhost:5432/plaza_dev?schema=public`)
   - `CLERK_SECRET_KEY`
   - `PHONE_HASH_SECRET`
   - `ENABLE_STATUS_SIMULATION=true` (optional, for dev)
   - Other required environment variables

5. **ConfigModule**: NestJS automatically loads `.env` file via `ConfigModule.forRoot()`. No custom scripts needed!

## Troubleshooting

### Database not starting
```bash
# Check Docker is running
docker ps

# Check database status
cd backend
./scripts/docker-db.sh status
```

### Port 5432 already in use
If you have another PostgreSQL instance running, either:
- Stop the other instance
- Change the port in `docker-compose.yml` (and update scripts accordingly)

### Migrations failing
```bash
# Reset database and try again
cd backend
./scripts/docker-db.sh reset
./scripts/test-migration.sh
```
