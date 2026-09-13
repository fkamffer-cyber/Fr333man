# FR333MAN deployment package

FR333MAN is a Next.js people platform with profiles, projects, products, invitation drafts, onboarding, private credential uploads, inventory administration, and a supervised Paystack checkout entry point. Supabase supplies authentication, Postgres data, row-level security, and private file storage.

## Tech stack

- Next.js 16 App Router, React 19, TypeScript
- Vercel serverless route handlers
- Supabase Auth, Postgres, Row Level Security, and Storage
- Paystack transaction initialization for approved products

## One-line setup and deploy

After extracting the ZIP and setting the environment variables: `pnpm install --frozen-lockfile && pnpm run build:vercel && npx vercel --prod`

## Required environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged route operations; never expose publicly |
| `PAYSTACK_SECRET_KEY` | Server only | Approved merchant transaction initialization |
| `PLATFORM_OWNER_EMAIL` | Server only | Bootstrap steward account email |
| `NEXT_PUBLIC_SITE_URL` | Browser + server | Canonical origin, for example `https://fr333man.co.za` |

Copy `.env.example` to `.env.local` for local development. In Vercel, add values in Project Settings → Environment Variables for Preview and Production; do not commit `.env.local`.

## Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `deployment/supabase/migrations/202609120001_freeland_core.sql` once, or copy the root `supabase` folder into a Supabase CLI project and run `supabase db push`.
3. In Authentication, enable Google, Apple, and/or Phone providers and add `http://localhost:3001/onboarding`, the Vercel preview callback pattern, and `https://fr333man.co.za/onboarding` to allowed redirects.
4. Put the project URL, publishable key, and service-role key into Vercel. The service-role key is server-only.
5. Create a user whose email matches `PLATFORM_OWNER_EMAIL`; this is the bootstrap platform steward.

This application uses the Supabase HTTPS client and does not require a direct database connection. If an external migration tool needs one, use the Supabase transaction-pooler format:

`postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`

Use the exact connection string supplied by the Supabase dashboard because the pooler host and region vary by project.

## Vercel

1. Import the extracted folder or run `npx vercel` from its root.
2. Keep Framework Preset as Next.js. The included root `vercel.json` selects `pnpm`, the production build, Frankfurt execution region, a `/home` redirect, and security headers.
3. Add all required environment values, deploy a Preview, and test onboarding, uploads, invitations, member writes, administration permissions, and approved-product checkout.
4. Promote only after applying the database migration and completing the external go-live items in `DEPLOYMENT_AUDIT.md`.

## Paystack and identity boundary

The included checkout route validates approved product IDs and policy acceptance, but points must only be allocated after a separately implemented and signature-verified Paystack settlement webhook. Identity evidence is stored in a private bucket; biometric/liveness matching requires an approved specialist provider and a completed POPIA/legal process.
