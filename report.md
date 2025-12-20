# 📘 Project Stacq — System Architecture & Developer Guide

**Welcome to Stacq.** This document is the single source of truth for the codebase. It explains *what* we built, *how* it works, and *where* everything lives.

---

## 1. 🚀 Project Overview

**Stacq** is a curated resource platform (like "Pinterest for Developers" or "Product Hunt for Tools"). Users can:
* **Create Cards:** Individual links to tools, articles, or resources.
* **Build Collections (Stacks):** Grouped cards (e.g., "Best React UI Libraries").
* **Save & Vote:** Save items to their library and upvote high-quality content.
* **Discover:** A ranking algorithm surfs trending content to the top.

---

## 2. 🛠️ Tech Stack

* **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
* **Language:** TypeScript
* **Styling:** Tailwind CSS + Framer Motion
* **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + RLS)
* **Caching:** Upstash Redis
* **Testing:** Vitest
* **Analytics:** Mixpanel + Web Vitals
* **Monitoring:** Sentry (Error Tracking) + Custom Logger
* **Infrastructure:** Vercel (Frontend/API) + GitHub Actions (Cron Jobs)

---

## 3. 🏗️ System Architecture

We follow a **strict layered architecture** to decouple the UI from the Backend.

### **The Layers**

1.  **UI Layer (`src/app`, `src/components`)**
    * **Rule:** Pure React Server Components (RSC) & Client Components.
    * **Prohibited:** Direct database calls.
    * **Allowed:** Fetching data via `src/lib/data` or calling API routes.

2.  **API Layer (`src/app/api`)**
    * Handles HTTP requests, validation, and permissions.
    * Delegates logic to Services or the DAL.

3.  **Service Layer (`src/lib/services`)**
    * Contains business logic (e.g., "What goes into a Feed?", "How do we calculate SEO?").
    * *Refactoring Note:* Older services mix DB logic; newer ones use the DAL.

4.  **Data Access Layer (DAL) (`src/lib/data`)**
    * **The Single Source of Truth.**
    * **Exports:** `db` object (e.g., `db.cards.getById(id)`).
    * **Adapters:** `src/lib/data/adapters/supabase.ts` implements the actual Supabase calls.
    * **Contracts:** defined in `src/lib/contracts.ts` (Enforces `Result<T>` pattern).

---

## 4. 📂 Folder Structure

```text
src/
├── app/                 # Next.js App Router (Pages & API Routes)
│   ├── (main)/          # Public & App Layouts
│   ├── (auth)/          # Auth Pages (Login/Signup)
│   └── api/             # API Endpoints (Workers, Webhooks, Data)
├── components/          # React Components
│   ├── ui/              # Reusable atoms (Button, Card, Modal)
│   ├── landing/         # Landing page specific components
│   └── [feature]/       # Feature-based components (feed, profile, etc.)
├── lib/
│   ├── data/            # 🛡️ Data Access Layer (The interface to DB)
│   │   ├── adapters/    # Implementation details (Supabase)
│   │   └── types.ts     # Data entities
│   ├── services/        # Business Logic (Feed, Search, Profile)
│   ├── contracts.ts     # 📜 System-wide Type Contracts (Result Pattern)
│   ├── logger.ts        # 🪵 Central Logging Service
│   ├── seo.ts           # Metadata generation
│   └── supabase/        # Legacy Supabase clients (being moved to adapters)
├── test/                # Test utilities & Mocks
└── hooks/               # Custom React Hooks
```

5. 🧠 Key Systems & Logic
A. Ranking Algorithm (src/lib/ranking)
We use a custom algorithm to rank "Trending" content.

Formula: Uses Wilson Score Interval + Time Decay.

Input: Upvotes, Saves, Click-throughs, Recency.

Automation: A GitHub Action (.github/workflows/ranking-worker.yml) hits a secure API endpoint every 6 hours to recompute scores.

B. Authentication & Roles
Provider: Supabase Auth.

Roles:

user: Can view, save, vote.

stacker: Verified creator, can publish public Cards/Collections.

admin: Full system access.

Guards: src/lib/auth/guards.ts protects server-side routes.

C. Metadata & SEO
Extractor: src/lib/metadata/extractor.ts fetches OpenGraph data from URLs when a user pastes a link.

Generator: src/lib/seo.ts generates dynamic <meta> tags for every page on Stacq.

D. Observability
Logger: src/lib/logger.ts handles all logs. In Dev -> Console; In Prod -> Sentry.

Web Vitals: src/components/analytics/WebVitals.tsx tracks real user performance (LCP, CLS) and sends to Mixpanel.

6. 🚧 Development Guidelines
Rules of Engagement
No Direct DB in UI: Never import createClient in a Page component. Use db from @/lib/data.

Strict Boundaries: .eslintrc.json enforces that only Adapters can touch the database library.

Result Pattern: Always return { success: true, data: ... } or { success: false, error: ... }. Do not throw Errors for expected failures (like "Not Found").

How to Run Locally
Bash

# 1. Install dependencies
npm install

# 2. Setup Env Vars
cp .env.example .env.local
# (Fill in Supabase URL/Key, Redis URL, Sentry DSN)

# 3. Run Development Server
npm run dev

# 4. Run Tests
npm test
Database Management
Database schema is managed via supabase/migrations.

Local changes should be squashed and applied via SQL migration files.

7. 🔮 Future Roadmap (Refactoring)
Phase 1 (Complete): DAL & Contracts defined.

Phase 2 (In Progress): Migrating feedService.ts and API routes to use db.* instead of raw supabase.* calls.

Goal: Fully separate the Application Logic from the Database Vendor.