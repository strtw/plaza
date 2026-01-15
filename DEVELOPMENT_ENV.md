# Development Environment Setup

This document outlines development-specific features and configurations for the Plaza app.

## Status Simulation Service

### Overview
A cron job that automatically simulates status changes for test users to help test the app's status functionality with realistic data changes.

### How It Works
- Runs at configurable interval (default: 5 minutes, set via `STATUS_SIMULATION_INTERVAL_MINUTES` env var)
- Finds primary user (clerkId starting with `'user_'`)
- Gets users who have added the primary user as friends
- Maximum of 10 users processed per run
- Randomly performs one of three actions for each user:
  - **Set status** (40% chance): Creates a new status if none exists
  - **Update status** (30% chance): Updates existing status with new message/location/endTime
  - **Clear status** (30% chance): Deletes existing status

### Status Details
- **Status type**: Always `AVAILABLE` (never `UNAVAILABLE`)
- **Messages**: Randomly selected from 20 predefined realistic messages (e.g., "Making dinner", "Going to the beach", "Grabbing coffee")
- **Location**: Randomly selected from `HOME`, `GREENSPACE`, or `THIRD_PLACE`
- **End time**: Randomly selected from 15-minute intervals (15, 30, 45, 60, 75, 90, 105, 120 minutes from now)
- **Start time**: Current time (`now`)

### Enabling/Disabling

The simulation is controlled by environment variables:

- **Enable**: Set `ENABLE_STATUS_SIMULATION=true` in your Railway environment variables
- **Disable**: Remove the variable or set it to anything other than `'true'`
- **Interval**: Set `STATUS_SIMULATION_INTERVAL_MINUTES` to control how often it runs (default: 5 minutes)
  - Example: Set to `10` to run every 10 minutes, `1` to run every minute

When disabled, the cron job still runs every minute but returns immediately (minimal compute cost).

### Safety Features

1. **Feature Flag**: Requires `ENABLE_STATUS_SIMULATION=true` to actually run
2. **Primary User**: Only finds users who have added the primary user (clerkId starting with `'user_'`) as friends
3. **User Limit**: Processes maximum of 10 users per run
4. **Error Handling**: Errors are logged but don't crash the cron job or affect other users
5. **Interval Control**: Configurable run frequency via `STATUS_SIMULATION_INTERVAL_MINUTES` env var

### Usage

1. Ensure you have friends in the database (users who have added you as a friend)
2. Set `ENABLE_STATUS_SIMULATION=true` in Railway environment variables
3. Optionally set `STATUS_SIMULATION_INTERVAL_MINUTES` to your desired interval (default: 5)
4. Wait for the configured interval for the first simulation run
5. Check the app to see statuses being created/updated/cleared automatically
6. When done testing, remove or disable the `ENABLE_STATUS_SIMULATION` env var

### Logs

The service logs all actions:
- `[DevService] Cron job triggered` (includes interval setting)
- `[DevService] Status simulation started`
- `[DevService] Found primary user: {userId}`
- `[DevService] Simulating status changes for X users who are broadcasting to primary user`
- `[DevService] Set/Updated/Cleared status for user X: "message" at LOCATION`
- `[DevService] Status simulation completed`

Check Railway logs to see the simulation activity.

### Cost Optimization

- **Default**: Feature is OFF (cron runs every minute but returns immediately - minimal cost)
- **When Testing**: Enable via env var, then disable when done
- **Interval Control**: Increase `STATUS_SIMULATION_INTERVAL_MINUTES` to reduce frequency and cost
- **Recommendation**: Only enable when actively testing status functionality

## Mock User Creation

### Overview
The "Create Mock Users" button in the Contacts tab automatically selects 3-4 random device contacts and creates them as Plaza users.

### How It Works
- Randomly selects 3-4 contacts from your device contacts
- Filters out contacts already in Plaza
- Creates users with:
  - `clerkId`: `test_{phoneNumber}` (identifies them as test users)
  - `firstName`/`lastName`: Parsed from device contact name
  - `phoneHash`: Hashed phone number
  - `email`: `test.{phoneNumber}@example.com`

### Usage
1. Open Contacts tab
2. Load device contacts (if not already loaded)
3. Click "Create Mock Users" button (dev environment only)
4. Selected contacts become Plaza users that can be used for testing

## Development Endpoints

All dev endpoints are protected by `NODE_ENV !== 'production'` checks and will return 403 Forbidden in production.

### Endpoints
- `POST /dev/mock-users` - Create mock users from phone contacts
- Status simulation runs automatically via cron (no endpoint needed)
