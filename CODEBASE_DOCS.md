# Stacq Codebase Documentation

## 1. Project Overview
**Stacq** is a human-curated resource platform (social bookmarking) where users organize links into **Collections** (formerly "Stacks") and **Cards**. It features a personalized feed, upvoting system, comments, and automated metadata extraction.

**Tech Stack:**
* **Framework:** Next.js 15 (App Router)
* **Language:** TypeScript
* **Database:** PostgreSQL (Supabase)
* **Auth:** Supabase Auth
* **Caching/Rate Limit:** Upstash Redis
* **Payments:** Stripe
* **Styling:** Tailwind CSS

---

## 2. Directory Structure
* `src/app/(main)`: Frontend UI pages (Feed, Collection, Profile).
* `src/app/api`: Backend Route Handlers.
* `src/app/api/workers`: Asynchronous background jobs (Ranking, Metadata).
* `src/lib`: Core business logic, shared utilities, and database clients.
* `src/components`: React UI components.
* `supabase/migrations`: SQL files defining the DB schema and triggers.

---

## 3. Database Schema (PostgreSQL)
The database is managed via Supabase migrations. Key tables include:

### Core Tables
* **`users`**: Profiles synced with Supabase Auth. Contains `quality_score`, `role` (user/admin/stacker).
* **`collections`** (Prev. `stacks`): Themed boards. Contains `owner_id`, `is_public`, `promoted_until`.
* **`cards`**: Individual resources (links). Contains `canonical_url`, `metadata` (JSONB), `stats`.
* **`collection_cards`**: Junction table linking Cards to Collections (Many-to-Many).

### Interaction Tables
* **`votes`**: Tracks upvotes. Unique constraint on `(user_id, target_id, target_type)`.
* **`saves`**: Bookmarks for users.
* **`comments`**: Threaded comments (supports nesting via `parent_id`).
* **`follows`**: Social graph (`follower_id`, `following_id`).

### Ranking & System
* **`ranking_scores`**: Stores computed scores for feed ordering.
* **`ranking_events`**: Log of actions (upvote, visit) used to recalculate scores.
* **`ranking_config`**: Dynamic weights for the algorithm (e.g., how much an upvote is worth).

---

## 4. The Worker System
The application uses a "Worker" pattern to handle heavy processing asynchronously. These are exposed as API endpoints in `src/app/api/workers/` and are typically triggered by **Cron Jobs** or **Webhooks**.

### A. Metadata Fetcher (`/api/workers/fetch-metadata`)
* **Trigger:** Called immediately after a user adds a link, or via Cron for backfilling.
* **Logic:**
    1.  Receives a `url` or `card_id`.
    2.  Uses `cheerio` (in `src/lib/metadata/extractor.ts`) to scrape the target page.
    3.  Extracts Open Graph tags (Title, Description, Image).
    4.  **Amazon Affiliate Logic:** Detects Amazon links and injects affiliate tags (`src/lib/affiliate/amazon.ts`).
    5.  Updates the `cards` table with the result.

### B. Ranking Engine (`/api/workers/ranking/*`)
* **Trigger:** Scheduled Cron Jobs (every X minutes).
* **Components:**
    * **Delta Updates:** Processes only items with recent activity (votes/views).
    * **Recompute:** Full recalculation of all scores (nightly).
* **Algorithm (`src/lib/ranking/algorithm.ts`):**
    * Based on "Hacker News" style gravity decay.
    * `Score = (P * Points) / (T + 2)^G`
    * `Points` = Weighted sum of Upvotes, Saves, Comments.
    * `T` = Time since creation (hours).
    * `G` = Gravity (decay factor).

### C. Link Health Checker (`/api/workers/check-links`)
* **Trigger:** Weekly Cron.
* **Logic:** Pings URLs in the database to check for 404s. Marks dead cards as `status: archived`.

---

## 5. Cron Jobs & Automation
Automation is handled in two layers:

1.  **Database Level (`pg_cron`):**
    * Configured in `supabase/migrations/013_setup_pg_cron_jobs.sql`.
    * Directly calls the Worker API endpoints (e.g., `SELECT net.http_post(...)`).
    * *Example:* Refreshing the Materialized View for the feed every 5 minutes.

2.  **GitHub Actions:**
    * Workflows in `.github/workflows/` trigger specific worker endpoints externally.
    * Used for tasks that might timeout inside a standard HTTP request or require external environment contexts.

---

## 6. Key Libraries & Utilities

### Database Clients (`src/lib/supabase`)
* **`api.ts`**: Uses `createServerClient` for Route Handlers (Passes User Cookies).
* **`client.ts`**: Uses `createBrowserClient` for Client Components.
* **`api-service.ts`**: Uses `createClient` with the **Service Role Key**.
    * *Warning:* Bypasses Row Level Security (RLS). Used only inside Workers/Admin routes.

### Redis Caching (`src/lib/redis.ts`)
* **Implementation:** Upstash Redis via REST HTTP.
* **Features:**
    * **Cache Stampede Protection:** Uses a "lock" key to prevent 100 users from hitting the DB simultaneously when a cache key expires.
    * **Fallback:** If Redis fails, it silently falls back to a direct DB query.

### Anti-Abuse (`src/lib/anti-abuse`)
* **Shadowbanning:** Users with `quality_score < 20` or `metadata: { shadowbanned: true }` can act normally, but their votes/comments are discarded silently.
* **Fingerprinting:** Basic IP/User-Agent hashing to detect vote manipulation rings.

---

## 7. Data Flow Examples

### Creating a Card
1.  **User** pastes a URL in the UI.
2.  **Frontend** calls `POST /api/cards`.
3.  **API** checks Rate Limits (Redis).
4.  **API** inserts basic row into `cards` table.
5.  **API** asynchronously calls `POST /api/workers/fetch-metadata` (Fire & Forget).
6.  **Worker** scrapes the URL and updates the DB row with title/image later.

### Loading the Feed
1.  **User** visits `/feed`.
2.  **API** (`GET /api/feed`) checks Redis Cache.
3.  **Cache Miss:**
    * Query `ranking_scores` (or `explore_ranking_items` view).
    * Join with `cards` and `collections`.
    * Mix content based on ratio (e.g., 60% cards, 40% collections).
4.  **Return:** JSON data + `nextCursor` for infinite scroll.

---

## 8. Common Gotchas for Developers
1.  **"Stacks" vs "Collections":** The codebase is migrating terminology.
    * UI/API mostly says "Collection".
    * Legacy DB tables/columns might still say "stack" (e.g., `stack_id`).
    * *Always check the migration files if a column isn't found.*
2.  **RLS Policies:** If an API call returns an empty array unexpectedly, it's likely a Row Level Security policy in Supabase. Check `002_rls_policies.sql`.
3.  **Service Role:** Do not use `createServiceClient()` in standard API routes. It bypasses security. Only use it for Workers/Webhooks.