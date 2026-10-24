# FR333MAN platform handover to Tiaan

Prepared: 22 October 2026
Source package: `Fr333man-Handover-Tiaan-2026-10-22.zip`
Repository: `https://github.com/fkamffer-cyber/Fr333man`
Current public URL: `https://fr333man.vercel.app/`

## Important source-of-truth note

The ZIP contains the latest local source, including work that had not yet been deployed to the public Vercel URL when this handover was created. Do not assume the current public URL and the ZIP are identical. Apply the database migrations, configure the environment variables, deploy a Vercel preview, and complete the acceptance checks below before promoting it to production.

No passwords, API keys, `.env.local`, Git history, dependency folders, build output, or local caches are included.

## Technology and entry points

- Next.js 16 App Router, React 19 and TypeScript
- Supabase Auth, Postgres, Row Level Security and Storage
- Vercel serverless route handlers under `src/app/api`
- Paystack transaction initialization and webhook handling
- Main interface: `src/app/page.tsx`
- Shop and inventory: `src/app/SalesDesk.tsx`
- Onboarding: `src/app/OnboardingWizard.tsx`
- Database migrations: `supabase/migrations`
- Environment template: `.env.example`
- Vercel configuration: `vercel.json`
- Full deployment instructions: `deployment/README.md`
- Production risk audit: `DEPLOYMENT_AUDIT.md`

## Implemented functionality

### People, authentication and onboarding

- Email magic-link sign-in through Supabase; optional Google, Apple and phone providers are feature-flagged.
- Five-step People onboarding with profile details, ten free-thinking questions, identity evidence, a joint selfie with an existing member, consent and fee acknowledgement.
- Private identity-document storage and pending review state.
- Public People profiles only after approval.
- Individual People page, individual shop and membership-card/QR preview workflow.
- Randburg is the current default profile and listing region.

### Feed and People page

- Public Feed reads active Supabase community posts.
- Publishing requires a real Supabase session and reports success only after the server saves the post.
- Signed-out visitors are shown a real sign-in action instead of a fake signed-in identity.
- Promotion choices are stored in Supabase and restored for the signed-in People member.
- My Page reads the signed-in member's published shop products and separately lists products the member promotes.
- Hard-coded promoted products and no-op promotion controls were removed.

### Shop and Marketplace

- Every approved People member can maintain a private Inventory and publish selected products to the shared Marketplace.
- Inventory status is unpublished or published; unpublishing returns the product to Inventory without deleting it.
- Product creation starts with a photo and supports up to ten JPEG, PNG or WebP images.
- Images are retained locally for offline drafts and uploaded to Supabase Storage for authenticated products.
- Product recognition can suggest a title, description and category when Google Cloud Vision is configured.
- Universal listing fields include title, price, category, subcategory, condition, description, stock, availability, location, delivery options, SKU, brand, model, GTIN and tags.
- Published Marketplace cards and product pages read live Supabase products and images.
- The latest schema migration adds the universal listing fields and channel-category support.

### Sales desk and external channels

- Channel-ready advert drafts, approval status, live URL recording, renewal dates and buyer follow-up records.
- Channels represented: Facebook, Gumtree, eBay, Bob Shop and Takealot.
- WhatsApp sharing and browser-native product sharing use the canonical public product URL.
- `/api/catalog/meta` exposes a Facebook/Meta catalogue CSV for published, permitted, in-stock products, including the main image and up to nine additional images.
- A listing is never reported as live until its external URL is recorded.

### Membership, payments and administration

- Monthly membership plans, selectable benefits/products and Supabase-backed membership records.
- Paystack transaction initialization, signed webhook processing and policy pages.
- Steward administration routes and ethics/dispute record foundations.
- Invitation creation from a public Facebook, LinkedIn, YouTube or ordinary web page, personalized messages and claim-on-onboarding links.

## Deliberately not represented as completed

- Facebook does not provide this application with a supported API that fills and publishes a listing to a person's personal Marketplace account. The supported implementation is the Meta/Facebook Store catalogue feed. A personal Marketplace listing remains a user-reviewed assisted process.
- eBay and Takealot publication require approved seller accounts and production API credentials. Bob Shop requires its accepted feed or seller workflow. Gumtree requires its supported seller workflow or written integration approval.
- External-channel buttons prepare records; they must not claim publication until a real API response or live listing URL exists.
- Automatic biometric matching is not implemented. Uploaded verification evidence requires an approved identity provider, POPIA impact assessment, consent, retention and reviewer process.
- Paystack must remain in test mode until merchant approval, legal business details, refund/delivery policies, webhook secret handling and end-to-end tests are complete.
- Product image recognition requires `GOOGLE_CLOUD_VISION_API_KEY` with API and origin restrictions.

## Supabase migration order

Apply every file in this exact order:

1. `202609120001_freeland_core.sql`
2. `202610130001_people_memberships.sql`
3. `202610130002_people_shops_products.sql`
4. `202610190001_multichannel_sales_pipeline.sql`
5. `202610200001_verified_people_welcome_shops.sql`
6. `202610210001_product_profile_relationship.sql`
7. `202610220001_universal_product_listing_fields.sql`

Use `supabase db push` from the extracted project, or apply the files in timestamp order through the Supabase SQL editor. Do not skip the final migration: the current product APIs query those columns.

## Environment configuration

Copy `.env.example` to `.env.local` for local development and configure the same values in Vercel. Never expose the service-role key or payment/channel secrets to browser code.

Minimum working configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PLATFORM_OWNER_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

Optional integrations are listed in `.env.example`. Enable each `NEXT_PUBLIC_*_AUTH_ENABLED` flag only after configuring the matching provider in Supabase.

## First deployment

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build:vercel
```

Then import the extracted folder into Vercel or run:

```bash
npx vercel --prod
```

Use Node.js 22 or newer. Configure Supabase Auth redirects for local development, the Vercel preview domain, the production Vercel domain and the final `fr333man.co.za` domain before testing sign-in.

## Required acceptance test

Test with three separate browser sessions: anonymous visitor, approved People member and platform steward.

1. Anonymous visitor can read Feed, People pages, policies, Marketplace and published products but cannot write.
2. Email sign-in returns to `/onboarding` and persists the Supabase session.
3. Onboarding uploads both private verification files and creates the pending profile.
4. Steward approval makes the People profile public and activates the member shop/welcome post workflow.
5. Approved member creates an Inventory product with multiple photos; refreshing the browser does not lose the saved item.
6. Publishing makes the product appear in Marketplace, its public product page and My Page → My shop products.
7. Promote adds the selected live product to My Page → Products I promote; Remove reverses it after refresh.
8. A signed-in member publishes a Feed post; it remains visible after refresh and in another browser.
9. Unpublish removes the product from Marketplace but retains it in Inventory.
10. `/api/catalog/meta` returns a valid CSV row containing the product's public URL and image URLs.
11. Paystack is tested with test credentials and a verified webhook before any live key is added.
12. No external advert is marked live without its confirmed platform URL.

## Verification at handover

- `npm run lint`: passed with no errors; only existing Next.js `<img>` optimization warnings remain.
- `npm run build:vercel`: passed, including TypeScript and all 18 application routes.
- The current package has not been declared production-approved. Complete the acceptance test and the external go-live items in `DEPLOYMENT_AUDIT.md`.
