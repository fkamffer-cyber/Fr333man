# FR333MAN deployment audit

Audit date: 2026-09-12

Verdict: **the source package is build-ready for Vercel and schema-ready for Supabase**. Production activation still requires a Supabase project, provider credentials, migration application, merchant approval, and identity-provider/legal sign-off.

## What was changed

- Migrated the application from the Cloudflare/Vinext runtime to standard Next.js App Router under `src/app`.
- Replaced D1 and R2 calls with Supabase Postgres, Auth, and private Storage.
- Added authenticated serverless routes for community records, invitations, onboarding, private uploads, inventory, and steward administration.
- Added same-origin write protection for local, Vercel preview, and production hosts.
- Kept secrets server-side and replaced deploy-specific values with blank environment templates.
- Added a five-step onboarding flow, Google/Apple/SMS entry authentication, required identity/witness uploads, ten free-thinking questions, and a pending-review state.
- Added public-page/YouTube invitation previews, personalized messages, unclaimed profile links, and claim-on-onboarding handling.
- Updated Francois Kamffer's region to Randburg.

## File and runtime inventory

- `src/app`: Next.js pages, client components, policies, and serverless route handlers.
- `src/lib`: server-only Supabase authentication and request-origin helpers.
- `public`: local image and favicon assets.
- `supabase/migrations`: Postgres schema, indexes, functions, triggers, RLS, grants, and private Storage policies.
- `deployment`: Vercel config, blank environment template, migration copy, and deployment runbook.

## npm package audit

Runtime: `next`, `react`, `react-dom`, `@supabase/supabase-js`.

Development: `typescript`, `eslint`, `eslint-config-next`, `tailwindcss`, `@tailwindcss/postcss`, and React/Node type packages.

No package in the final dependency list requires a persistent process, local filesystem persistence, Cloudflare binding, or other serverless-incompatible runtime. Node.js 22 or newer is required.

## External calls

- Supabase Auth, PostgREST, and Storage through `@supabase/supabase-js`.
- Paystack transaction initialization at `api.paystack.co`; it is disabled until `PAYSTACK_SECRET_KEY` is supplied.
- User-requested public website/YouTube HTML preview fetches in `/api/link-preview`; private-network addresses and redirects are rejected.
- Google Fonts CSS and font files loaded by the browser from `fonts.googleapis.com`/`fonts.gstatic.com`.
- Facebook Marketplace, Gumtree, Bob Shop, and eBay are outbound links only; this package does not publish or message through their APIs.

## Security and configuration findings

- No credential values were found in source files.
- All secrets are read through `process.env`; only the Supabase URL and publishable key use the browser-visible `NEXT_PUBLIC_` prefix.
- API exceptions return generic client messages without stack traces or provider error bodies.
- No `console.log`, `console.debug`, test-person references, or generated build folders are included in the archive.
- Database mutations use authenticated server routes and the service role; table grants are read-only for browser roles. Private uploads remain scoped by Storage RLS to the signed-in user's folder.
- The public URL preview blocks obvious private IP ranges and validates redirects. For a high-risk production threat model, place this feature behind a dedicated URL-scanning proxy with DNS-rebinding protection.

## External go-live items

1. Apply the migration, configure Google/Apple/SMS Auth providers, and set exact redirect URLs.
2. Sign in with `PLATFORM_OWNER_EMAIL`; that account is the bootstrap steward. Then test anonymous/member/steward access separately.
3. Complete Paystack merchant verification and add signed webhook settlement before issuing points from payments. Never award points from browser redirects.
4. Select a specialist identity/liveness provider and complete a POPIA impact assessment, retention/deletion rules, reviewer training, and explicit biometric consent. This package stores uploaded evidence privately but does not perform biometric matching.
5. Add rate limiting/WAF controls, transactional email/SMS, monitoring, backups, restore testing, accessibility checks, and incident contacts before public launch.
6. Point `fr333man.co.za` to Vercel only after preview acceptance.
