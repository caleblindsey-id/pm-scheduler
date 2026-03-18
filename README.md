# PM Scheduler

Preventive maintenance scheduling and billing tool for commercial cleaning equipment — built to replace EasyBee and integrate with Synergy ERP.

## Tech Stack

- **Frontend / Backend:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Database:** Supabase (PostgreSQL) — hosted, with auth and row-level security
- **Hosting:** Vercel
- **Nightly Sync:** Python 3.9+ script (runs on workstation via Windows Task Scheduler)

## Prerequisites

- Node.js 18+
- Python 3.9+ (for nightly sync script)
- A Supabase account — [supabase.com](https://supabase.com)
- Access to the Synergy workstation with the `ERPlinked` ODBC DSN configured (for sync script only)

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd pm-scheduler
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and wait for it to provision.

### 4. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and replace the placeholder values with your actual Supabase URL and keys. Find these in your Supabase project under **Settings → API**.

### 5. Apply database migrations

Go to your Supabase project → **SQL Editor**, and run each migration file in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_indexes.sql`

For development, you can also run the seed data:

4. `supabase/seed.sql` — see the file header for important notes about user Auth account setup

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Sync Script Setup

The nightly Synergy sync script pulls customer, contact, and product data from Synergy ERP into Supabase.

See [`scripts/sync/README.md`](scripts/sync/README.md) for setup and scheduling instructions.

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo.
3. In the Vercel project settings, add the following environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Vercel handles builds and deploys automatically on every push to `main`.

## Project Structure

```
pm-scheduler/
├── src/app/              # Next.js App Router pages and API routes
├── supabase/
│   ├── migrations/       # SQL migration files — run in order via Supabase SQL Editor
│   └── seed.sql          # Development seed data
├── scripts/
│   └── sync/             # Nightly Synergy sync script (Python)
├── docs/
│   └── specs/            # Design specifications
└── .env.local.example    # Environment variable template
```

## Design Spec

Full architecture, database schema, user roles, workflows, and EasyBee migration notes:
[`docs/specs/2026-03-18-pm-scheduler-design.md`](docs/specs/2026-03-18-pm-scheduler-design.md)
