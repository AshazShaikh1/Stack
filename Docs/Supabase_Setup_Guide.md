# Supabase Setup Guide

Complete guide to set up Supabase for the Stack MVP project.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed
3. Git installed

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: stacks-mvp (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for MVP
4. Click "Create new project"
5. Wait for project to be provisioned (2-3 minutes)

## Step 2: Get API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Step 3: Run Database Migrations

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```
(Find project-ref in project settings → General → Reference ID)

4. Run migrations:
```bash
supabase db push
```

### Option B: Using Supabase Dashboard

1. Go to **SQL Editor** in your Supabase dashboard
2. Run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_storage_buckets.sql` (review for storage setup)
   - `supabase/migrations/004_user_profile_trigger.sql`
   - `supabase/migrations/005_fix_cards_rls.sql`
3. For each file: Copy and paste into SQL Editor, then click "Run"

## Step 4: Set Up Storage Buckets

1. Go to **Storage** in your Supabase dashboard
2. Create three buckets:

   **Bucket 1: thumbnails**
   - Name: `thumbnails`
   - Public: ✅ Yes
   - File size limit: 5 MB
   - Allowed MIME types: `image/*`

   **Bucket 2: cover-images**
   - Name: `cover-images`
   - Public: ✅ Yes
   - File size limit: 10 MB
   - Allowed MIME types: `image/*`

   **Bucket 3: avatars**
   - Name: `avatars`
   - Public: ✅ Yes
   - File size limit: 2 MB
   - Allowed MIME types: `image/*`

3. For each bucket, set up policies (or use the SQL from `003_storage_buckets.sql`):
   - **Public read access** for all buckets
   - **Authenticated upload** for thumbnails and cover-images
   - **User-specific upload** for avatars (users can only upload to their own folder)

## Step 5: Configure Authentication

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable providers you want:
   - ✅ **Email** (enabled by default)
   - ✅ **Google** (optional, for OAuth)
   - ✅ **GitHub** (optional, for OAuth)

3. For OAuth providers:
   - Follow Supabase's OAuth setup guide
   - Add redirect URLs: `http://localhost:3000/auth/callback`

4. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize welcome, password reset, etc.

## Step 6: Set Up Environment Variables

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Add other service credentials as needed (Upstash, Stripe, etc.)

## Step 7: Test the Setup

1. Start your development server:
```bash
npm run dev
```

2. Visit http://localhost:3000
3. Try signing up a new user
4. Check Supabase dashboard → **Authentication** → **Users** to see the new user
5. Check **Table Editor** → **users** to see the user profile

## Step 8: Realtime (Not Used)

Realtime/replication is not used in this project. All updates are handled via manual refetch after user actions (e.g., posting a comment, voting).

## Step 9: Set Up Database Functions (Optional)

For the explore ranking refresh:

1. Go to **Database** → **Functions** in Supabase dashboard
2. Create a new function or use pg_cron extension
3. Schedule `refresh_explore_ranking()` to run every 5-15 minutes

Or use Supabase Edge Functions or external cron service.

## Step 10: Verify RLS Policies

1. Go to **Authentication** → **Policies** in Supabase dashboard
2. Verify all tables have RLS enabled
3. Test policies by:
   - Creating a test user
   - Trying to access other users' data
   - Verifying private stacks are not accessible

## Troubleshooting

### Migration Errors

- **"relation already exists"**: Tables already created. Drop and recreate or skip.
- **"permission denied"**: Make sure you're using the service role key for migrations.
- **"extension not found"**: Enable required extensions in Supabase dashboard → Database → Extensions

### RLS Policy Issues

- **Can't read own data**: Check policy conditions match your use case
- **Can't insert**: Verify INSERT policies allow authenticated users
- **Service role bypass**: Service role bypasses RLS, use anon key for client-side

### Storage Issues

- **Can't upload**: Check bucket policies allow authenticated uploads
- **403 Forbidden**: Verify file size and MIME type restrictions
- **Public URL not working**: Ensure bucket is marked as public

## Next Steps

After Supabase is set up:

1. ✅ Database schema created
2. ✅ RLS policies configured
3. ✅ Storage buckets ready
4. ✅ Authentication configured
5. ⏭️ Set up Upstash Redis for rate limiting
6. ⏭️ Set up Stripe for payments
7. ⏭️ Continue with Stage 2: Core Features

## Useful Links

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Dashboard](https://app.supabase.com)
- [RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

