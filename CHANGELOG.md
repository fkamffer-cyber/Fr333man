# FR333MAN releases

## v0.31.4 — Sites release 36 — 2026-11-04

- Made restricted Facebook and LinkedIn links produce clean, editable profile names instead of platform-labelled placeholders.
- Added authenticated profile-photo upload for invitation drafts when a social platform withholds its public image.
- Kept the import status explicit so inferred, uploaded and platform-returned data cannot be confused.

## v0.31.3 — Sites release 35 — 2026-11-04

- Repaired hosted Supabase initialization by loading the public project URL and publishable key from the deployment runtime before the client application starts.
- Kept deployment values out of the repository while allowing one build to run correctly on both Sites and Vercel.
- Added a no-store, same-origin public configuration response containing only the browser-safe Supabase connection values.

## v0.31.2 — Sites release 34 — 2026-11-04

- Enabled the provisioned Google OAuth entry point for People onboarding on both hosted deployments.
- Kept an explicit `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` emergency rollback without requiring every host to duplicate the enabled default.
- Preserved Facebook and LinkedIn as hidden until their provider identity-verification requirements are completed.

## v0.31.1 — Sites release 33 — 2026-11-04

- Repaired signed-out invitation creation so a reviewed draft always produces a working shareable claim link.
- Preserved tracked invitation codes for signed-in People while providing a clear portable-link fallback when tracking is unavailable.
- Added an explicit import report so Facebook and LinkedIn restrictions cannot be mistaken for a successful photo or biography import.
- Added real Google, Facebook, LinkedIn OIDC, Apple and Microsoft onboarding entry points that appear only after their Supabase providers are enabled.
- Prefilled editable People display names, avatar names and profile photos from the account owner's consented OAuth profile.
- Added regression coverage for Unicode-safe, URL-safe invitation draft encoding and decoding.

## v0.31.0 — Sites release 32 — 2026-11-03

- Removed the remaining sample People, product, project and Feed-comment records from the live interface.
- Connected Projects and project collaboration state to shared Supabase community records.
- Added persisted Feed comments and Love reactions with working share links.
- Replaced simulated Studio buttons with real local camera, microphone and screen-preview checks.
- Made the Feed show honest empty states and current live People/project counts.

## v0.30.1 — Sites release 31 — 2026-11-03

- Replaced Next client-link prefetching on public policy and product links with stable native navigation for the Sites runtime.
- Cleared the production RSC-prefetch console error found during the release 30 smoke test.

## v0.30.0 — Sites release 30 — 2026-11-03

- Corrected ZAR product prices so major currency values are stored as cents exactly once.
- Added regression tests for South African currency formats.
- Changed Marketplace publication to require steward compliance approval for new products.
- Removed public sample-product fallback from direct product URLs.
- Synchronized the deployment migrations with the transactional onboarding and profile-visibility repairs.
- Applied the Peopleship terminology migration and documented the one-time first-steward bootstrap.
- Removed sample project assignments from People profile pages.
- Upgraded the production framework to a patched release and refreshed deployment verification.

## v0.29.0 — Sites release 29 — 2026-10-28

- Replaced the free-text onboarding questionnaire with ten multiple-choice questions.
- Preserved onboarding answers and the intended step across email-link and OAuth sign-in.
- Added public/private profile selection and clear instructions for changing it later.
- Repaired invitation URL normalization, platform-specific preview handling, initials fallback and claim links.
- Added tracked invitation codes when Supabase server storage is available.
- Replaced public-facing Membership wording with Peopleship while retaining stable database identifiers.
- Added the visible release label used to identify deployed builds.

## v0.28.x and earlier

Legacy hosted releases created before release labels were added.
