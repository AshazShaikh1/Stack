# Bug Tracking & Solutions

This document tracks known issues, bugs, and their solutions to help prevent recurring problems and speed up debugging.

## Format

Each entry should follow this structure:

```markdown
### [Issue Title]
**Date:** YYYY-MM-DD
**Status:** Open / Resolved / Investigating
**Severity:** Critical / High / Medium / Low

**Description:**
[Clear description of the issue]

**Error Details:**
[Error messages, stack traces, console logs]

**Root Cause:**
[What caused the issue]

**Solution:**
[Step-by-step solution or workaround]

**Prevention:**
[How to prevent this issue in the future]
```

## Known Issues

### RLS Policy Violation for Cards Table
**Date:** 2024-12-19
**Status:** Resolved
**Severity:** High

**Description:**
When clicking "Add Card", the API route was getting "new row violates row-level security policy for table 'cards'" error.

**Error Details:**
```
Error: new row violates row-level security policy for table "cards"
```

**Root Cause:**
1. The RLS policy required `auth.uid() = created_by`, but the server-side Supabase client in API routes wasn't properly passing the auth context from cookies.
2. The server.ts client uses `cookies()` from Next.js which works in Server Components but not properly in API routes.

**Solution:**
1. Created `src/lib/supabase/api.ts` with a client that reads cookies from the request object (works in API routes).
2. Updated `src/app/api/cards/route.ts` to use the API client instead of server client.
3. Created migration `005_fix_cards_rls.sql` to make the RLS policy more permissive (allows any authenticated user).

**Prevention:**
- Always use the API client (`createClient` from `@/lib/supabase/api`) in API routes.
- Use the server client (`createClient` from `@/lib/supabase/server`) only in Server Components.
- Test RLS policies with actual authenticated requests, not just service role.

### Realtime Removed
**Date:** 2024-12-19
**Status:** Resolved
**Severity:** N/A

**Description:**
Realtime/replication features have been removed from the project. All updates are now handled via manual refetch after user actions.

**Reason:**
Realtime requires replication which may have cost implications. The app works perfectly without it - users just need to refresh to see other users' changes.

**Solution:**
- Removed all realtime subscription code from `useVotes.ts` and `useComments.ts`
- Removed realtime migration files
- Updated documentation to reflect this change
- App now uses optimistic updates + manual refetch pattern

## Resolved Issues

_Issues are moved here after being resolved and verified._
