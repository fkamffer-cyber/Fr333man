-- Persist each member's public/private choice without exposing a pending profile.
alter table public.onboarding_submissions
  add column if not exists profile_public_after_approval boolean not null default true;

-- Preserve the current visibility of memberships that predate this preference.
update public.onboarding_submissions submission
set profile_public_after_approval = profile.is_public
from public.profiles profile
where profile.user_id = submission.user_id
  and submission.status = 'approved';

create or replace function public.submit_people_onboarding_v2(
  applicant uuid,
  requested_avatar text,
  applicant_region text,
  requested_member_type text,
  free_thinking_answers jsonb,
  witness_handle text,
  identity_path text,
  selfie_path text,
  identity_consent boolean,
  witness_consent boolean,
  accepted_terms boolean,
  accepted_privacy boolean,
  acknowledged_fee boolean,
  invitation_id uuid default null,
  requested_profile_public boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  submission_result jsonb;
  publish_after_approval boolean := coalesce(requested_profile_public, true);
begin
  submission_result := public.submit_people_onboarding(
    applicant,
    requested_avatar,
    applicant_region,
    requested_member_type,
    free_thinking_answers,
    witness_handle,
    identity_path,
    selfie_path,
    identity_consent,
    witness_consent,
    accepted_terms,
    accepted_privacy,
    acknowledged_fee,
    invitation_id
  );

  update public.onboarding_submissions
  set profile_public_after_approval = publish_after_approval,
      updated_at = now()
  where user_id = applicant;

  return submission_result || jsonb_build_object(
    'profilePublic', publish_after_approval
  );
end;
$$;

revoke all on function public.submit_people_onboarding_v2(uuid,text,text,text,jsonb,text,text,text,boolean,boolean,boolean,boolean,boolean,uuid,boolean) from public,anon,authenticated;
grant execute on function public.submit_people_onboarding_v2(uuid,text,text,text,jsonb,text,text,text,boolean,boolean,boolean,boolean,boolean,uuid,boolean) to service_role;

-- Keep the reviewed approval implementation intact and wrap it so the saved
-- visibility preference is applied atomically before the transaction commits.
do $migration$
begin
  if to_regprocedure('public.approve_people_member_base(text,uuid)') is null then
    if to_regprocedure('public.approve_people_member(text,uuid)') is null then
      raise exception 'approve_people_member(text,uuid) must exist before this migration';
    end if;
    execute 'alter function public.approve_people_member(text,uuid) rename to approve_people_member_base';
  end if;
end;
$migration$;

revoke all on function public.approve_people_member_base(text,uuid) from public,anon,authenticated,service_role;

create or replace function public.approve_people_member(target_handle text, reviewer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approval_result jsonb;
  approved_user_id uuid;
  welcome_id bigint;
  publish_profile boolean;
begin
  approval_result := public.approve_people_member_base(target_handle, reviewer);
  approved_user_id := (approval_result ->> 'userId')::uuid;

  select
    coalesce(submission.profile_public_after_approval, true),
    submission.welcome_post_id
  into publish_profile, welcome_id
  from public.onboarding_submissions submission
  where submission.user_id = approved_user_id;

  update public.profiles
  set is_public = coalesce(publish_profile, true),
      updated_at = now()
  where user_id = approved_user_id;

  if welcome_id is not null then
    update public.community_records
    set data = data || jsonb_build_object(
          'profilePublic', coalesce(publish_profile, true)
        ),
        updated_at = now()
    where id = welcome_id and owner_id = approved_user_id;
  end if;

  return approval_result || jsonb_build_object(
    'profilePublic', coalesce(publish_profile, true)
  );
end;
$$;

revoke all on function public.approve_people_member(text,uuid) from public,anon,authenticated;
grant execute on function public.approve_people_member(text,uuid) to service_role;
