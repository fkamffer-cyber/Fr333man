# First People steward

Normal onboarding requires an existing approved People witness. A new deployment therefore needs exactly one manually verified root steward before anyone else can submit.

Use the Supabase SQL editor once, after confirming the owner account in `auth.users` and completing the owner’s offline identity check. The bootstrap transaction must:

1. Refuse to run if any row already exists in `public.profiles`.
2. Create only the configured platform owner as an `approved` `steward`.
3. Create or activate that owner’s shop.
4. Add a `bootstrap-steward` record to `public.admin_audit` describing the root-of-trust exception.

Do not add a reusable public bootstrap endpoint and do not weaken `submit_people_onboarding_v2`. After the first steward exists, every applicant must use the standard identity-document, approved-witness and joint-selfie workflow.

The FR333MAN production project completed this one-time bootstrap on 2026-11-03. Re-running it is neither required nor permitted.
