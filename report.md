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

### External Services Setup
- **Supabase**: Database, Auth, Storage, Realtime
- **Upstash Redis**: Caching and rate limiting
- **Stripe**: Payment processing (promoted collections, featured users)
- **Mixpanel**: Analytics tracking
- Configuration documented in `Expected_Setup.md`

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
- Upvote, comment, clone, and follow notifications
- Notification dropdown component
- Realtime subscriptions via Supabase

### Search
- Full-text search for collections, cards, and users
- **Migration**: `010_search_users_function.sql` - User search function

### Browser Extension
- Plasmo-based browser extension
- Quick save current page to selected collection
- Extension authentication flow

---

## Phase 3: Database Optimizations & Performance

### Ranking System
- Materialized view for explore ranking
- Periodic refresh via pg_cron
- **Migrations**:
  - `011_setup_ranking_refresh.sql` - Ranking refresh setup
  - `031_create_ranking_system.sql` - Complete ranking implementation
  - `033_add_performance_indexes.sql` - Performance indexes

### Performance Indexes
- Indexes on frequently queried columns
- Full-text search indexes
- Composite indexes for feed queries
- **Migration**: `033_add_performance_indexes.sql`

### Caching Strategy
- Redis caching for feed data
- Rate limiting implementation
- SWR for client-side data fetching

### Background Jobs
- Metadata fetching worker (GitHub Actions)
- Link health checker
- Ranking refresh scheduler
- **Migrations**:
  - `013_setup_pg_cron_jobs.sql` - Scheduled jobs
  - `020_link_checker_setup.sql` - Link checking

---

## Phase 4: Security & Anti-Abuse

### Row Level Security (RLS)
- Comprehensive RLS policies for all tables
- User-specific data access
- Public/private collection visibility
- **Migrations**: `002_rls_policies.sql`, `005_fix_cards_rls.sql`

### Moderation
- Comment moderation system
- Report functionality
- Auto-cleanup of cloned collections
- **Migrations**:
  - `024_add_comment_moderation.sql` - Comment moderation
  - `012_auto_cleanup_clones.sql` - Clone cleanup

### Rate Limiting
- Upstash Redis rate limiting
- API endpoint protection
- User action throttling

---

## Phase 5: UI/UX Redesign

### Design System Update
**Color Palette:**
- Replaced black/jet accents with **Emerald Green (#1DB954)**
- Updated `tailwind.config.ts` with emerald color variants
- Updated `globals.css` with new CSS variables

**Typography:**
- Increased heading sizes (h1: 40px, h2: 28px, h3: 22px)
- Improved line heights and letter spacing
- Better contrast and readability

**Components:**
- Updated `Button.tsx` - Emerald primary buttons with shadows
- Updated `Card.tsx` - Softer shadows, better borders
- Enhanced hover states and transitions

### Landing Page Redesign
**New Content:**
- Headline: "Discover and organize the best resources—curated by real people"
- Sub-headline explaining Stacq's purpose
- Primary CTA: "Get started"
- Secondary CTA: "Browse Collections"

**New Sections:**
- **Hero Section** (`HeroSection.tsx`): Animated hero with gradient backgrounds and decorative shapes
- **How It Works** (`HowItWorksSection.tsx`): 3-step explanation with icons (FolderPlus, Link2, Share2) and alternating image/text layout
- **Trending Section** (`TrendingSection.tsx`): Displays 4 collections + 4 cards with categories
- **CTA Section** (`CTASection.tsx`): Call-to-action with gradient background
- **Footer** (`LandingFooter.tsx`): Brand, Product, and Account links

**Visual Enhancements:**
- Framer Motion animations for scroll-triggered effects
- Geometric blobs and gradients
- Responsive design (mobile-first)
- Lucide React icons

### Home Page (Feed) Redesign
**FeedPage Updates:**
- Larger, responsive typography
- Emerald green filter buttons with active states
- Improved empty and error states
- Better spacing and visual hierarchy

**CollectionCard Updates:**
- Replaced all indigo/blue colors with emerald green
- Collection badge: `bg-emerald`
- Upvote icons: `fill-emerald`
- Save buttons: `bg-emerald/emerald-dark`
- Tags: `bg-emerald/10 text-emerald`
- Placeholder gradients: emerald variants

**CardPreview Updates:**
- Save icon colors changed to emerald
- Consistent emerald accent throughout

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Flexible grid layouts
- Touch-friendly interactions

---

## Phase 6: Bug Fixes & Corrections

### Database Issues
1. **Column name errors**: Fixed `canonical_url_hash` → `canonical_url` references
2. **Table name updates**: Fixed `stack_id` → `collection_id` in `card_attributions` table
3. **Index errors**: Corrected index creation on non-existent columns
4. **Migration**: `001_fix_promoted_index.sql` - Fixed promoted collection index

### Code Issues
1. **React Hooks**: Added missing `useState` import in `FeedPage.tsx`
2. **Server/Client Components**: Split animated sections into client components to fix Framer Motion errors
3. **Redis JSON**: Removed manual JSON parsing (Upstash handles automatically)

### Save System Fixes
- Fixed save counter not updating on refresh
- Corrected save count triggers
- **Migration**: `032_fix_card_saves_count_trigger.sql` - Fixed save count trigger

---

## Phase 7: Component Architecture

### Server vs Client Components
- **Server Components**: Data fetching, static content (`LandingPage.tsx`)
- **Client Components**: Interactivity, animations (`HeroSection.tsx`, `HowItWorksSection.tsx`, `TrendingSection.tsx`)
- Proper separation for optimal performance

### Component Structure
```
/components
  /ui          - Reusable UI components (Button, Card, Dropdown)
  /landing     - Landing page sections
  /feed        - Feed and grid components
  /collection  - Collection-specific components
  /card        - Card-specific components
  /layout      - Layout components (Header, Sidebar, Footer)
```

---

## Key Migrations Summary

**Core Schema:**
- `001_initial_schema.sql` - Base tables
- `002_rls_policies.sql` - Security policies
- `003_storage_buckets.sql` - Storage setup

**Features:**
- `017_follows_table.sql` - Follow system
- `025_create_saves_table.sql` - Save functionality
- `026_stackers_and_standalone_cards.sql` - Standalone cards
- `029_rename_stacks_to_collections.sql` - Naming update

**Performance:**
- `011_setup_ranking_refresh.sql` - Ranking refresh
- `031_create_ranking_system.sql` - Ranking algorithm
- `033_add_performance_indexes.sql` - Performance indexes

**Fixes:**
- `030_fix_saves_table.sql` - Save table fixes
- `032_fix_card_saves_count_trigger.sql` - Save count trigger
- `001_fix_promoted_index.sql` - Index fixes

---

## Current Status

### Completed
✅ Core platform functionality (Collections, Cards, Feed, Explore)
✅ User interactions (Upvotes, Comments, Saves, Follows)
✅ Authentication and user profiles
✅ Real-time notifications
✅ Search functionality
✅ UI/UX redesign with emerald green theme
✅ Responsive design for all pages
✅ Performance optimizations
✅ Security and anti-abuse measures

### Documentation
- `Expected_Setup.md` - Complete setup guide
- `docs/Implementation.md` - Implementation tracking
- `docs/UI_UX_doc.md` - Design system
- `docs/Bug_tracking.md` - Known issues and solutions
- `docs/project_structure.md` - Project organization

---

## Next Steps (Potential)

- Browser extension polish
- Advanced feed personalization
- Enhanced search with filters
- Collection templates
- Social features expansion
- Analytics dashboard
- Mobile app development

---

**Report Generated:** 2025
**Platform:** Stacq (Human-curated resource collections)
**Status:** MVP Complete, Production Ready

