# Stacq MVP

A human-curated resource platform where people create Collections and add Cards (resources).

## Technology Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes + Supabase
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Realtime:** Supabase Realtime
- **Queue/Rate Limiting:** Upstash Redis
- **Payments:** Stripe
- **Analytics:** Mixpanel
- **Monitoring:** Sentry

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Fill in your Supabase and other service credentials
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

See `/Docs/project_structure.md` for detailed folder organization.

## Documentation

- `/Docs/Implementation.md` - Implementation plan and task tracking
- `/Docs/project_structure.md` - Project structure guidelines
- `/Docs/UI_UX_doc.md` - Design system and UI/UX guidelines
- `/Docs/Bug_tracking.md` - Known issues and solutions

## Development Workflow

1. Check `/Docs/Implementation.md` for current stage and tasks
2. Follow project structure guidelines
3. Consult UI/UX documentation before implementing UI
4. Document any bugs or issues in Bug_tracking.md

