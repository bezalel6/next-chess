# Admin Setup Guide

## Overview
This guide explains how to manage admin users for the Ban Chess platform.

## Single Source of Truth: `admin-config.ts`

All admin users are managed through a single configuration file: **`admin-config.ts`**

This file contains the `ADMIN_EMAILS` array where you define who has admin access.

## How to Add/Remove Admins

### 1. Edit the Admin Config File

Open `admin-config.ts` and modify the `ADMIN_EMAILS` array:

```typescript
export const ADMIN_EMAILS = [
  "admin@example.com",    // Add your email here
  "another@admin.com",    // Add more admins as needed
] as const;
```

### 2. Apply the Changes

After editing the config file, run:

```bash
npm run setup:admins
```

This command will:
- Read the emails from `admin-config.ts`
- Check if users exist in the system
- Add them to the `admins` table in Supabase
- Show you the current list of admins

### 3. Important Notes

- **Users must sign up first**: A user needs to create an account before they can be made an admin
- **Safe and secure**: The `admins` table has Row Level Security (RLS) enabled
- **No client modifications**: Admins can only be added via the backend/dashboard
- **Single source**: Always use `admin-config.ts` as the source of truth

## Database Structure

The system uses a dedicated `admins` table with:
- `user_id`: Reference to the auth.users table
- `email`: The admin's email address
- `created_at`: When the admin was added
- `notes`: Optional notes about the admin

## Security Features

1. **Row Level Security (RLS)**: Only admins can view the admin list
2. **No client modifications**: The table cannot be modified from the client
3. **Backend only**: Admins must be added via the setup script or Supabase dashboard
4. **Function helpers**: `is_admin()` and `is_current_user_admin()` functions for checking admin status

## Accessing the Admin Dashboard

Once you're an admin, navigate to `/admin` to access the dashboard.

The dashboard includes:
- User management
- Game statistics
- Real-time activity monitoring
- System metrics and charts

## Troubleshooting

### User not found error
- Make sure the user has signed up/logged in at least once
- Check that the email in `admin-config.ts` matches exactly

### Admins table doesn't exist
- Run migrations: `npx supabase db push`
- Or apply manually: `npx supabase db execute -f supabase/migrations/20250814_create_admins_table.sql`

### Can't access admin dashboard
- Verify you're logged in with an admin account
- Check that your email is in the `admins` table
- Run `npm run setup:admins` to sync the config

## Manual Admin Management (Alternative)

If needed, you can also manage admins directly in the Supabase dashboard:

1. Go to your Supabase project
2. Navigate to Table Editor → `admins`
3. Add a new row with the user's `user_id` and `email`

However, using `admin-config.ts` is recommended for consistency and version control.