# Implementation Plan for Stack (MVP)

# When creating UI use the imspiration image provided if not provided ask for them and visit /Docs/UI_UX_doc.md for more info

## Feature Analysis

### Identified Features:

1. **Stacks (Boards)** - Create/edit/delete boards with public/private/unlisted visibility, tags, and cover images
2. **Cards (Resources)** - Add resources by URL with auto-metadata extraction or manual entry; canonical resources that can belong to multiple stacks
3. **Feed** - Personalized feed for signed-in users based on tag interactions and trending content
4. **Explore** - Browse categories, trending stacks, top stackers with filters (Most Upvoted/Newest)
5. **Profile** - User profiles showing created/saved stacks with basic stats (views, upvotes)
6. **Upvote** - Quality upvote system on stacks and cards (one per user)
7. **Comments** - Threaded comments on stacks and cards with real-time updates
8. **Notifications** - Real-time in-app notifications for upvotes, comments, clones, follows
9. **Clone** - Create private clone of any public stack
10. **Browser Extension** - Quick save current page to selected stack via Plasmo extension
11. **Search** - Full-text search using Postgres tsvector + pg_trgm for fuzzy matching
12. **Authentication** - Supabase Auth with email + OAuth providers
13. **Monetization** - Minimal MVP monetization: Promoted Stacks, Featured Stackers, Paid hidden Stacks, Reserve username
14. **Realtime Updates** - Real-time UI updates for comments, votes, notifications, follows using Supabase Realtime

### Feature Categorization:

- **Must-Have Features:**
  - Stacks (create/edit/delete, visibility, tags, cover image)
  - Cards (URL-based with auto-metadata, manual entry)
  - Authentication (Supabase Auth)
  - Feed (personalized for signed-in users)
  - Explore (trending, categories, filters)
  - Profile (created/saved stacks, basic stats)
  - Upvote (on stacks and cards)
  - Comments (threaded, real-time)
  - Notifications (real-time in-app)
  - Clone (private clone of public stacks)
  - Search (Postgres full-text)
  - Realtime updates (comments, votes, notifications)

- **Should-Have Features:**
  - Browser Extension (quick save)
  - Monetization (promoted stacks, featured stackers, paid hidden stacks)

- **Nice-to-Have Features:**
  - Advanced personalization algorithms
  - Email digest notifications
  - Advanced analytics dashboard

## Recommended Tech Stack

### Frontend:

- **Framework:** Next.js 14+ (App Router) with TypeScript - Modern React framework with excellent SSR/ISR support for SEO, built-in API routes, and optimal performance
- **Documentation:** https://nextjs.org/docs

- **Styling:** Tailwind CSS - Utility-first CSS framework for rapid UI development with consistent design system
- **Documentation:** https://tailwindcss.com/docs

### Backend:

- **Framework:** Next.js API Routes + Supabase - Serverless API routes with Supabase for database, auth, storage, and realtime
- **Documentation:** 
  - Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
  - Supabase: https://supabase.com/docs

### Database & Infrastructure:

- **Database:** Supabase (PostgreSQL) - Managed PostgreSQL with built-in auth, storage, and realtime subscriptions
- **Documentation:** https://supabase.com/docs/guides/database

- **Storage:** Supabase Storage - For images, thumbnails, and cover images
- **Documentation:** https://supabase.com/docs/guides/storage

- **Realtime:** Supabase Realtime - WebSocket-based real-time updates for comments, votes, notifications
- **Documentation:** https://supabase.com/docs/guides/realtime

### Queue & Rate Limiting:

- **Service:** Upstash Redis (Serverless) - Serverless Redis for rate limiting and queue orchestration
- **Documentation:** https://docs.upstash.com/redis

- **Workers:** Vercel Serverless Functions / Supabase Edge Functions - Background job processing
- **Documentation:** 
  - Vercel Functions: https://vercel.com/docs/functions
  - Supabase Edge Functions: https://supabase.com/docs/guides/functions

### Browser Extension:

- **Framework:** Plasmo - Modern browser extension framework with React support
- **Documentation:** https://docs.plasmo.com

### Payments:

- **Service:** Stripe (Checkout + Webhooks) - Payment processing for monetization features
- **Documentation:** https://stripe.com/docs

### Analytics & Monitoring:

- **Analytics:** Mixpanel - User behavior tracking and analytics
- **Documentation:** https://developer.mixpanel.com/docs

- **Error Monitoring:** Sentry - Error tracking and performance monitoring
- **Documentation:** https://docs.sentry.io

## Implementation Stages

### Stage 1: Foundation & Setup
**Duration:** 1-2 weeks
**Dependencies:** None

#### Sub-steps:

- [x] Set up Next.js 14 project with TypeScript and App Router
- [x] Configure Tailwind CSS with design system tokens (Jet color, spacing, typography)
- [ ] Set up Supabase project and configure environment variables
- [ ] Create database schema migrations (all tables: users, stacks, cards, stack_cards, tags, stack_tags, card_tags, votes, comments, notifications, clones, link_checks, reports, payments, explore_ranking materialized view)
- [ ] Implement database constraints, indexes, and triggers (unique constraints, full-text search indexes, tsvector columns)
- [ ] Set up Row-Level Security (RLS) policies for all tables
- [ ] Configure Supabase Auth (email + OAuth providers: Google, GitHub)
- [ ] Set up Supabase Storage buckets (thumbnails, cover-images, avatars)
- [ ] Initialize Upstash Redis for rate limiting
- [ ] Set up Vercel project and configure environment variables
- [x] Create project folder structure (components, app, lib, types, utils)
- [ ] Set up TypeScript types for database schema
- [x] Configure ESLint, Prettier, and Git hooks
- [ ] Set up Sentry for error monitoring
- [ ] Set up Mixpanel for analytics tracking
- [x] Create basic authentication pages (login, signup, password reset)

### Stage 2: Core Features
**Duration:** 3-4 weeks
**Dependencies:** Stage 1 completion

#### Sub-steps:

- [x] Implement user profiles (display_name, username, avatar, stats)
- [x] Build Stack creation flow (create/edit/delete, title, description, tags, cover image, visibility settings)
- [x] Implement Stack detail page (header with cover, title, desc, tags, action bar: Upvote, Save, Share, Clone)
- [x] Build Card creation flow (URL input, metadata fetching, manual override, thumbnail upload)
- [ ] Implement metadata fetcher worker (Open Graph extraction, URL canonicalization, deduplication)
- [x] Create Stack-Card mapping system (many-to-many relationship) - Implemented via stack_cards table
- [x] Build masonry grid layout for feed, explore, and profile pages
- [x] Implement Feed page with personalized algorithm (tag-based boosting, trending)
- [x] Build Explore page (categories, trending stacks, top stackers, filters: Most Upvoted/Newest)
- [x] Create Profile page (created stacks, saved stacks, basic stats: views, upvotes)
- [x] Implement Upvote system (one per user, account age check 48h, real-time updates)
- [x] Build Comments system (threaded comments with 4-level nesting, real-time updates)
- [x] Implement Search functionality (Postgres full-text search + pg_trgm fuzzy matching)
- [x] Create explore_ranking materialized view and refresh job (every 5-15 minutes)
- [x] Build basic admin UI for reports and moderation
- [x] Implement rate limiting for all APIs (card creation, votes, comments, clones)

### Stage 3: Advanced Features
**Duration:** 2-3 weeks
**Dependencies:** Stage 2 completion

#### Sub-steps:

- [x] Implement Clone feature (private clone of public stacks, 10/day limit, auto-cleanup after 7 days)
- [x] Build Browser Extension with Plasmo (IMPLEMENTED - custom extension with multi-type card creation)
- [x] Implement Notifications system (IMPLEMENTED - real-time notifications with dropdown)
- [x] Build notification bell component (IMPLEMENTED - NotificationDropdown with unread count)
- [x] Implement Follow system (follow/unfollow stackers, follower counts, real-time updates)
- [x] Create Monetization features (Promoted Stacks, Featured Stackers, Paid hidden Stacks, Reserve username)
- [x] Integrate Stripe Checkout for payments
- [x] Build Stripe webhook handler for payment processing
- [x] Implement link health checker worker (periodic checks, broken link notifications)
- [ ] Create fraud detection worker (vote spikes, clone spikes, extension anomalies)
- [ ] Implement comment moderation (OpenAI/Perspective API integration, auto-hide toxic comments)
- [ ] Build reports system (user reporting, admin review queue)
- [ ] Create quality_score calculation worker (periodic updates for users)
- [ ] Implement anti-abuse controls (device fingerprinting, IP clustering, shadowbanning)

### Stage 4: Polish & Optimization
**Duration:** 1-2 weeks
**Dependencies:** Stage 3 completion

#### Sub-steps:

- [x] Implement optimistic UI patterns for all real-time actions (votes, comments, saves) - Comments implemented
- [ ] Add loading states and skeleton screens for all async operations
- [ ] Optimize images (next/image, responsive sizes, CDN delivery)
- [ ] Implement SEO optimization (metadata, Open Graph tags, sitemap, robots.txt)
- [ ] Add accessibility features (ARIA labels, keyboard navigation, focus management, prefers-reduced-motion)
- [ ] Conduct comprehensive testing (unit tests, integration tests, E2E tests)
- [ ] Performance optimization (code splitting, lazy loading, bundle size optimization)
- [ ] Implement error boundaries and graceful error handling
- [ ] Add comprehensive error messages with user-friendly copy
- [ ] Create empty states with CTAs for all pages
- [ ] Implement analytics events tracking (signup, create_stack, add_card, extension_save, clone_stack, upvote, comment, purchase_promotion)
- [ ] Set up monitoring alerts (cards/day per user, votes surge, extension saves spike)
- [ ] Conduct security audit (RLS policies, rate limiting, input validation)
- [ ] Prepare deployment configuration (environment variables, build settings)
- [ ] Create deployment documentation and runbooks
- [ ] Set up staging environment for testing
- [ ] Conduct final QA and bug fixes

## Resource Links

### Technology Documentation:

- **Next.js:** https://nextjs.org/docs
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Supabase:** https://supabase.com/docs
- **Supabase Database:** https://supabase.com/docs/guides/database
- **Supabase Auth:** https://supabase.com/docs/guides/auth
- **Supabase Storage:** https://supabase.com/docs/guides/storage
- **Supabase Realtime:** https://supabase.com/docs/guides/realtime
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Upstash Redis:** https://docs.upstash.com/redis
- **Plasmo:** https://docs.plasmo.com
- **Stripe:** https://stripe.com/docs
- **Mixpanel:** https://developer.mixpanel.com/docs
- **Sentry:** https://docs.sentry.io

### Best Practices & Guides:

- **Next.js App Router Best Practices:** https://nextjs.org/docs/app/building-your-application/routing
- **Supabase RLS Best Practices:** https://supabase.com/docs/guides/database/postgres/row-level-security
- **PostgreSQL Full-Text Search:** https://www.postgresql.org/docs/current/textsearch.html
- **PostgreSQL pg_trgm Extension:** https://www.postgresql.org/docs/current/pgtrgm.html
- **React Optimistic UI Patterns:** https://react.dev/learn/queueing-a-series-of-state-updates
- **Web Accessibility Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

### Tutorials & Getting Started:

- **Next.js Learn Course:** https://nextjs.org/learn
- **Supabase Quickstart:** https://supabase.com/docs/guides/getting-started
- **Plasmo Getting Started:** https://docs.plasmo.com/framework/workflows/getting-started
- **Stripe Integration Guide:** https://stripe.com/docs/payments/checkout

## Technical Constraints & Considerations

### Performance Requirements:

- Feed and Explore pages must load in < 2 seconds
- Real-time updates must appear within 100ms
- Image thumbnails must be optimized and served via CDN
- Materialized view refresh should not block user queries

### Scalability Considerations:

- Start with Upstash Redis for rate limiting (migrate to BullMQ + managed Redis if needed)
- Use Supabase connection pooling for database connections
- Implement pagination for all list views
- Cache hot pages in Redis

### Security Requirements:

- All user inputs must be validated and sanitized
- RLS policies must be tested thoroughly before public launch
- Rate limiting must be enforced on all user-facing APIs
- Authentication tokens must be properly secured
- Extension must use short-lived tokens

### Anti-Abuse Measures:

- Implement all rate limits as specified in PRD
- Device fingerprinting for sockpuppet detection
- Quality score system to throttle low-quality users
- Automated moderation for comments
- Fraud detection workers for anomaly detection

## Timeline Summary

- **Stage 1 (Foundation):** 1-2 weeks
- **Stage 2 (Core Features):** 3-4 weeks
- **Stage 3 (Advanced Features):** 2-3 weeks
- **Stage 4 (Polish & Optimization):** 1-2 weeks

**Total Estimated Duration:** 7-11 weeks (approximately 2-3 months)

## Team Requirements

- **Frontend Developer:** Next.js, React, TypeScript, Tailwind CSS
- **Backend Developer:** Node.js, PostgreSQL, Supabase, API design
- **Full-Stack Developer:** Can handle both frontend and backend tasks
- **DevOps:** Vercel deployment, environment configuration, monitoring setup

## Next Steps

1. Review and approve this implementation plan
2. Set up development environment and tools
3. Begin Stage 1: Foundation & Setup
4. Create `project_structure.md` with detailed folder structure
5. Create `UI_UX_doc.md` with design system specifications
