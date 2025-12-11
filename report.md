# Stacq Platform - Development Report

## Project Overview

**Stacq** (formerly Stack) is a human-curated resource platform where users create **Collections** (themed boards) and add **Cards** (resources like links, videos, articles, tools). The platform enables discovery, curation, and community interaction through upvotes, comments, saves, and follows.

**Technology Stack:**
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Backend: Next.js API Routes + Supabase
- Database: PostgreSQL (Supabase)
- Storage: Supabase Storage
- Realtime: Supabase Realtime
- Caching/Rate Limiting: Upstash Redis
- Payments: Stripe
- Analytics: Mixpanel
- Charts: Recharts

---

## Phase 1: Initial Setup & Infrastructure

### Project Structure
- Established Next.js 14 App Router structure
- Configured TypeScript with strict type checking
- Set up Tailwind CSS with custom design tokens
- Created component library structure (`/components/ui`, `/components/landing`, `/components/feed`, etc.)

### Database Schema
**Migration Files:**
- `001_initial_schema.sql` - Core tables (users, collections, cards, comments, tags)
- `002_rls_policies.sql` - Row Level Security policies
- `003_storage_buckets.sql` - Storage bucket configuration
- `004_user_profile_trigger.sql` - Auto-create user profiles
- `005_fix_cards_rls.sql` - Card access policies

### Authentication
- Supabase Auth integration (email/password + OAuth)
- Google OAuth setup
- GitHub OAuth setup
- User profile management with avatars

---

## Phase 2: Core Features Implementation

### Collections
- Create, edit, delete collections
- Public/private/unlisted visibility
- Cover images and tags
- Collection pages with card masonry layout
- **Migration**: `029_rename_stacks_to_collections.sql` - Renamed stacks to collections

### Cards (Resources)
- Add cards by URL with automatic metadata fetching
- Manual card creation
- Thumbnail generation and storage
- Card deduplication by canonical URL
- Card preview component with metadata
- **Migrations**: 
  - `026_stackers_and_standalone_cards.sql` - Standalone card support
  - `027_backfill_card_attributions.sql` - Card attribution tracking

### Feed & Explore
- Personalized feed algorithm
- Trending collections and cards
- Explore page with filters (Most Upvoted, Newest)
- Feed grid component with responsive layout
- **Migration**: `031_create_ranking_system.sql` - Ranking algorithm implementation

### User Interactions
- **Upvotes**: One vote per user per collection/card
- **Comments**: Threaded comments with nesting limit
- **Saves**: Save collections and cards to personal library
- **Follows**: Follow other users (stacqers)
- **Migrations**:
  - `017_follows_table.sql` - Follow system
  - `025_create_saves_table.sql` - Save functionality
  - `030_fix_saves_table.sql` - Save table fixes

### Notifications
- Real-time in-app notifications
- Notification dropdown component
- Realtime subscriptions via Supabase

### Search
- Full-text search for collections, cards, and users
- **Migration**: `010_search_users_function.sql` - User search function

---

## Phase 3: Database Optimizations & Performance

### Ranking System
- Materialized view for explore ranking
- Periodic refresh via pg_cron
- **Migrations**:
  - `011_setup_ranking_refresh.sql` - Ranking refresh setup
  - `031_create_ranking_system.sql` - Complete ranking implementation
  - `033_add_performance_indexes.sql` - Performance indexes

### Caching Strategy
- Redis caching for feed data
- Rate limiting implementation
- SWR for client-side data fetching

---

## Phase 4: Security & Anti-Abuse

### Row Level Security (RLS)
- Comprehensive RLS policies for all tables
- User-specific data access
- Public/private collection visibility

### Moderation
- Comment moderation system
- Report functionality
- **Migrations**:
  - `024_add_comment_moderation.sql` - Comment moderation
  - `012_auto_cleanup_clones.sql` - Clone cleanup

---

## Phase 5: UI/UX Redesign

### Design System Update
- **Theme**: Emerald Green (#1DB954) accents
- **Typography**: Optimized for readability
- **Components**: Updated Button, Card, and Input styles

### Landing Page
- Animated hero section
- "How It Works" visualization
- Trending preview section

---

## Phase 6: Bug Fixes & Corrections

### Critical Fixes
1. **Hydration Errors**: Fixed "nested `<a>` tag" errors in `CardPreview` and `CollectionCard` by implementing an overlay link pattern with z-index layering.
2. **Legacy Table References**: Fixed `api/comments` and `api/votes` crashing due to "relation stacks does not exist". Updated logic to map legacy `target_type='stack'` to the `collections` table.
3. **RLS Policies**: Fixed an issue where owners could not see their own private standalone cards. Updated RLS to allow `auth.uid() = created_by`.
4. **Feed Visibility**: Fixed logic in `ExplorePage` that was inadvertently hiding valid public cards due to overly strict RLS/Query combinations.
5. **Type Safety**: Resolved TypeScript errors in API routes (`getCommentDepth` implicit any) and notification logic (`targetItem[ownerField]` indexing).
6. **Code Cleanup**: Removed deprecated `setStacks` placeholder function that was causing runtime errors in `CreateCardModal`.

---

## Phase 7: Component Architecture

### Server vs Client Components
- Separated interactive logic (`CardActionsBar`, `ExpandableDescription`) from server-rendered pages (`CardPage`).
- Optimized `lazy` loading for heavy components like `CommentsSection`.

---

## Phase 8: Post-MVP Enhancements (Recent Updates)

### 1. Advanced Notifications
- **New Types**: Added support for `new_card` and `new_collection` notifications.
- **Logic**: Backend now automatically notifies followers when a user posts public content.
- **UI**: Updated `NotificationDropdown` to handle new types, added **"Mark as read"** and **"Clear list"** features.

### 2. Enhanced Card Experience
- **Dedicated Card Page**: Created `/card/[id]` with a rich, two-column layout.
  - Left: Full media, metadata, "YouTube-style" Creator info, and comments.
  - Right: Related resources sidebar.
- **Interactive Elements**:
  - `CardActionsBar`: Integrated Upvote, Save, and Share buttons.
  - `ExpandableDescription`: "Read more" functionality for long text.
  - `CreatorInfo`: User avatar, name, and **Follow** button directly on the card page.

### 3. Profile & Social
- **Role-Based Navigation**: Added conditional buttons on the Profile page:
  - **Creator Dashboard**: Visible only to Stackers/Admins.
  - **Reports/Ranking**: Visible only to Admins.
- **Follower/Following Modals**: Clicking stats on the profile header now opens a modal listing the users.
- **Attribution**: "Created by [User]" links in cards now correctly route to user profiles without triggering card clicks.

### 4. Creator Dashboard (Stacker Pro)
- **Redesign**: Completely overhauled `/stacker/dashboard` with a modern "Bento Grid" layout.
- **Visualization**: Integrated `recharts` for Area, Bar, and Pie charts.
- **Freemium Model**:
  - **Free**: Basic views, upvotes, and 30-day history.
  - **Premium (Paywalled)**: Growth Velocity, Conversion Funnel, and 1-year history.
  - **Paywall UI**: Implemented `PaywallModal` and blurred UI states to upsell Stacq Pro.

---

## Current Status

### Completed
✅ Core platform functionality (Collections, Cards, Feed, Explore)
✅ User interactions (Upvotes, Comments, Saves, Follows)
✅ Authentication and user profiles
✅ Real-time notifications (including New Post alerts)
✅ Search functionality
✅ UI/UX redesign with emerald green theme
✅ **Creator Dashboard with Analytics & Paywalls**
✅ **Dedicated Card Details Page**
✅ Security and anti-abuse measures

### Documentation
- `Expected_Setup.md` - Complete setup guide
- `docs/Implementation.md` - Implementation tracking
- `docs/UI_UX_doc.md` - Design system
- `docs/Bug_tracking.md` - Known issues and solutions

---

## Next Steps

- **Monetization**: Connect the "Upgrade" buttons in the dashboard to real Stripe checkout sessions.
- **Search**: Connect "Related Cards" to vector search for better relevance (currently uses domain matching).
- **Mobile App**: Wrap the responsive web app into a native container or build React Native version.

---

**Report Generated:** 2025
**Platform:** Stacq
**Status:** MVP Complete + Phase 8 Enhancements