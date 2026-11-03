# FR333MAN releases

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
