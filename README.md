# FR333MAN Autonomy Hub

FR333MAN is a People community platform built with Next.js and Supabase. It includes member profiles, onboarding and verification workflows, a community Feed, individual shops, a shared marketplace, memberships, invitations, project collaboration, private document storage, and a supervised multichannel sales desk.

## Stack

- Next.js 16 and React 19
- Supabase Auth, Postgres, Row Level Security, and Storage
- Vercel serverless deployment
- Paystack checkout integration for approved products and memberships

## Local development

1. Install Node.js 22 and pnpm.
2. Copy `.env.example` to `.env.local` and enter the required development values.
3. Apply every migration in `supabase/migrations` to a Supabase project in timestamp order.
4. Run `pnpm install --frozen-lockfile`.
5. Run `pnpm dev` and open `http://localhost:3001`.

Never commit `.env.local`, Supabase service-role keys, Paystack secrets, or seller-channel credentials.

## Verification

```bash
pnpm run lint
pnpm run build:vercel
```

## Deployment

Import this repository into Vercel, configure the variables listed in `.env.example`, and use the included `vercel.json`. Supabase setup, authentication redirects, migrations, storage policies, and the production checklist are documented in [deployment/README.md](deployment/README.md) and [DEPLOYMENT_AUDIT.md](DEPLOYMENT_AUDIT.md).

The current ChatGPT Sites project metadata remains in `.openai/hosting.json`; Vercel production does not use the Sites D1/R2 bindings.
