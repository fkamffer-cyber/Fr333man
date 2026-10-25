-- Restore the server role's intended access and make People onboarding/approval atomic.
-- RLS still protects browser clients; these grants are only for the server-held service key.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

alter table public.onboarding_submissions
  add column if not exists witness_user_id uuid references public.profiles(user_id) on delete set null,
  add column if not exists identity_document_verified_at timestamptz;

create index if not exists idx_onboarding_witness_user on public.onboarding_submissions(witness_user_id);
create unique index if not exists profiles_avatar_name_lower_key on public.profiles(lower(avatar_name));

create or replace function public.submit_people_onboarding(
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
  invitation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_avatar text := btrim(requested_avatar);
  normalized_region text := coalesce(nullif(btrim(applicant_region),''),'Randburg');
  normalized_witness text := ltrim(btrim(witness_handle),'@');
  witness_id uuid;
  witness_avatar text;
  existing_shop_slug text;
  desired_shop_slug text;
  identity_exists boolean;
  selfie_exists boolean;
begin
  if applicant is null or not exists(select 1 from auth.users where id=applicant) then
    raise exception 'Authenticated People account not found';
  end if;
  if normalized_avatar !~ '^[A-Za-z0-9._-]{3,40}$' then
    raise exception 'Choose a 3-40 character avatar name using letters, numbers, dots, dashes or underscores';
  end if;
  if char_length(normalized_region) > 80 then
    raise exception 'Region must be 80 characters or fewer';
  end if;
  if requested_member_type not in ('profile','project','administration') then
    raise exception 'Choose a valid membership path';
  end if;
  if free_thinking_answers is null or jsonb_typeof(free_thinking_answers) <> 'array' then
    raise exception 'Complete all 10 free-thinking answers with at least 10 characters each';
  end if;
  if jsonb_array_length(free_thinking_answers) <> 10
     or exists(
       select 1
       from jsonb_array_elements(free_thinking_answers) as answer(value)
       where jsonb_typeof(value) <> 'string'
          or char_length(btrim(value #>> '{}')) < 10
     ) then
    raise exception 'Complete all 10 free-thinking answers with at least 10 characters each';
  end if;
  if not coalesce(identity_consent,false)
     or not coalesce(witness_consent,false)
     or not coalesce(accepted_terms,false)
     or not coalesce(accepted_privacy,false)
     or not coalesce(acknowledged_fee,false) then
    raise exception 'All identity, witness, terms, privacy and fee acknowledgements are required';
  end if;
  if identity_path is null
     or identity_path not like applicant::text||'/identity/%'
     or identity_path ~ '(^|/)\.\.(/|$)' then
    raise exception 'The identity upload does not belong to this People account';
  end if;
  if selfie_path is null
     or selfie_path not like applicant::text||'/witness-selfie/%'
     or selfie_path ~ '(^|/)\.\.(/|$)' then
    raise exception 'The joint selfie does not belong to this People account';
  end if;

  select exists(
    select 1 from storage.objects where bucket_id='private-vault' and name=identity_path
  ) into identity_exists;
  select exists(
    select 1 from storage.objects where bucket_id='private-vault' and name=selfie_path
  ) into selfie_exists;
  if not identity_exists or not selfie_exists then
    raise exception 'Verification upload is missing; upload both files again';
  end if;

  select p.user_id,p.avatar_name into witness_id,witness_avatar
  from public.profiles p
  where lower(p.avatar_name)=lower(normalized_witness)
    and p.trust_status='approved'
  limit 1;
  if witness_id is null then
    raise exception 'The witness must be an existing approved People member';
  end if;
  if witness_id=applicant then
    raise exception 'A different approved People member must witness this account';
  end if;
  if exists(
    select 1 from public.onboarding_submissions s
    where s.user_id=applicant and s.status='approved'
  ) then
    raise exception 'This People membership has already been approved';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(normalized_avatar),0));
  if exists(
    select 1 from public.profiles p
    where lower(p.avatar_name)=lower(normalized_avatar) and p.user_id<>applicant
  ) then
    raise exception 'This avatar name is already in use';
  end if;

  insert into public.profiles(
    user_id,avatar_name,display_name,region,member_type,trust_status,is_public
  ) values(
    applicant,normalized_avatar,normalized_avatar,normalized_region,requested_member_type,'pending_review',false
  )
  on conflict(user_id) do update set
    avatar_name=excluded.avatar_name,
    display_name=coalesce(nullif(public.profiles.display_name,''),excluded.display_name),
    region=excluded.region,
    member_type=excluded.member_type,
    trust_status='pending_review',
    is_public=false,
    updated_at=now();

  insert into public.onboarding_submissions(
    user_id,answers,witness_handle,witness_user_id,identity_document_path,witness_selfie_path,
    identity_consent_at,witness_consent_at,terms_accepted_at,privacy_accepted_at,
    fee_acknowledged_at,status,reviewer_id,review_reason,submitted_at,
    identity_document_verified_at,witness_selfie_verified_at,verified_at,welcome_post_id
  ) values(
    applicant,free_thinking_answers,witness_avatar,witness_id,identity_path,selfie_path,
    now(),now(),now(),now(),now(),'pending_identity_review',null,null,now(),
    null,null,null,null
  )
  on conflict(user_id) do update set
    answers=excluded.answers,
    witness_handle=excluded.witness_handle,
    witness_user_id=excluded.witness_user_id,
    identity_document_path=excluded.identity_document_path,
    witness_selfie_path=excluded.witness_selfie_path,
    identity_consent_at=excluded.identity_consent_at,
    witness_consent_at=excluded.witness_consent_at,
    terms_accepted_at=excluded.terms_accepted_at,
    privacy_accepted_at=excluded.privacy_accepted_at,
    fee_acknowledged_at=excluded.fee_acknowledged_at,
    status='pending_identity_review',
    reviewer_id=null,
    review_reason=null,
    submitted_at=now(),
    identity_document_verified_at=null,
    witness_selfie_verified_at=null,
    verified_at=null,
    welcome_post_id=null,
    updated_at=now();

  select s.slug into existing_shop_slug from public.shops s where s.owner_id=applicant;
  if existing_shop_slug is null then
    desired_shop_slug := trim(both '-' from regexp_replace(lower(normalized_avatar),'[^a-z0-9]+','-','g'));
    if char_length(desired_shop_slug)<3 then
      desired_shop_slug := 'people-'||substr(replace(applicant::text,'-',''),1,8);
    end if;
    if exists(select 1 from public.shops s where s.slug=desired_shop_slug and s.owner_id<>applicant) then
      desired_shop_slug := left(desired_shop_slug,51)||'-'||substr(replace(applicant::text,'-',''),1,8);
    end if;
    insert into public.shops(owner_id,slug,name,description,region,status)
    values(applicant,desired_shop_slug,normalized_avatar||' Shop','Products and offers from this People member.',normalized_region,'draft');
    existing_shop_slug := desired_shop_slug;
  else
    update public.shops set
      name=normalized_avatar||' Shop',
      region=normalized_region,
      status='draft',
      updated_at=now()
    where owner_id=applicant;
  end if;

  if invitation_id is not null then
    update public.invitations set status='claimed',claimed_by=applicant
    where id=invitation_id and status='unclaimed' and expires_at>now();
    if not found then
      raise exception 'This invitation is invalid, expired or already claimed';
    end if;
  end if;

  return jsonb_build_object(
    'userId',applicant,
    'avatarName',normalized_avatar,
    'status','pending_identity_review',
    'shopSlug',existing_shop_slug
  );
end;
$$;

revoke all on function public.submit_people_onboarding(uuid,text,text,text,jsonb,text,text,text,boolean,boolean,boolean,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.submit_people_onboarding(uuid,text,text,text,jsonb,text,text,text,boolean,boolean,boolean,boolean,boolean,uuid) to service_role;

drop function if exists public.approve_people_member(text,uuid);
create function public.approve_people_member(target_handle text, reviewer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_handle text := ltrim(btrim(target_handle),'@');
  member_profile public.profiles%rowtype;
  submission public.onboarding_submissions%rowtype;
  witness_profile public.profiles%rowtype;
  created_post_id bigint;
  created_shop_slug text;
  identity_exists boolean;
  selfie_exists boolean;
begin
  if reviewer is null or not exists(select 1 from auth.users where id=reviewer) then
    raise exception 'A signed-in People steward must perform approval';
  end if;

  select * into member_profile
  from public.profiles p
  where lower(p.avatar_name)=lower(normalized_handle)
  for update;
  if member_profile.user_id is null then
    raise exception 'People profile not found';
  end if;

  select * into submission
  from public.onboarding_submissions s
  where s.user_id=member_profile.user_id
  for update;
  if submission.user_id is null or submission.status not in ('pending_identity_review','approved') then
    raise exception 'People onboarding is not ready for identity review';
  end if;
  if submission.identity_document_path is null
     or submission.witness_selfie_path is null
     or submission.identity_consent_at is null
     or submission.witness_consent_at is null
     or submission.terms_accepted_at is null
     or submission.privacy_accepted_at is null
     or submission.fee_acknowledged_at is null then
    raise exception 'Complete identity evidence and all consents are required before approval';
  end if;

  select exists(
    select 1 from storage.objects
    where bucket_id='private-vault' and name=submission.identity_document_path
  ) into identity_exists;
  select exists(
    select 1 from storage.objects
    where bucket_id='private-vault' and name=submission.witness_selfie_path
  ) into selfie_exists;
  if not identity_exists or not selfie_exists then
    raise exception 'Stored identity evidence is missing; the member must upload it again';
  end if;

  if submission.witness_user_id is not null then
    select * into witness_profile from public.profiles p where p.user_id=submission.witness_user_id;
  else
    select * into witness_profile
    from public.profiles p
    where lower(p.avatar_name)=lower(ltrim(btrim(submission.witness_handle),'@'))
    limit 1;
  end if;
  if witness_profile.user_id is null or witness_profile.trust_status<>'approved' then
    raise exception 'The witness must still be an approved People member';
  end if;
  if witness_profile.user_id=member_profile.user_id then
    raise exception 'A People member cannot witness their own account';
  end if;

  select s.slug into created_shop_slug from public.shops s where s.owner_id=member_profile.user_id;
  if created_shop_slug is null then
    created_shop_slug := trim(both '-' from regexp_replace(lower(member_profile.avatar_name),'[^a-z0-9]+','-','g'));
    if char_length(created_shop_slug)<3 then
      created_shop_slug := 'people-'||substr(replace(member_profile.user_id::text,'-',''),1,8);
    end if;
    if exists(select 1 from public.shops s where s.slug=created_shop_slug) then
      created_shop_slug := left(created_shop_slug,51)||'-'||substr(replace(member_profile.user_id::text,'-',''),1,8);
    end if;
    insert into public.shops(owner_id,slug,name,description,region,status)
    values(
      member_profile.user_id,
      created_shop_slug,
      coalesce(nullif(member_profile.display_name,''),member_profile.avatar_name)||' Shop',
      'Products and offers from this People member.',
      member_profile.region,
      'active'
    );
  else
    update public.shops set status='active',region=member_profile.region,updated_at=now()
    where owner_id=member_profile.user_id;
  end if;

  update public.profiles set trust_status='approved',is_public=true,updated_at=now()
  where user_id=member_profile.user_id;

  created_post_id := submission.welcome_post_id;
  if created_post_id is null then
    insert into public.community_records(entity,owner_id,title,data,status)
    values(
      'post',
      member_profile.user_id,
      'Welcome @'||member_profile.avatar_name||' to the People community',
      jsonb_build_object(
        'kind','member_welcome',
        'body','A People steward approved this member''s identity evidence and joint member-witness selfie.',
        'memberName',coalesce(nullif(member_profile.display_name,''),member_profile.avatar_name),
        'handle','@'||member_profile.avatar_name,
        'profileUrl','/people/'||member_profile.avatar_name,
        'bioUrl','/people/'||member_profile.avatar_name||'#about',
        'shopUrl','/shops/'||created_shop_slug,
        'witnessHandle','@'||witness_profile.avatar_name
      ),
      'active'
    ) returning id into created_post_id;
  else
    update public.community_records set
      title='Welcome @'||member_profile.avatar_name||' to the People community',
      data=jsonb_build_object(
        'kind','member_welcome',
        'body','A People steward approved this member''s identity evidence and joint member-witness selfie.',
        'memberName',coalesce(nullif(member_profile.display_name,''),member_profile.avatar_name),
        'handle','@'||member_profile.avatar_name,
        'profileUrl','/people/'||member_profile.avatar_name,
        'bioUrl','/people/'||member_profile.avatar_name||'#about',
        'shopUrl','/shops/'||created_shop_slug,
        'witnessHandle','@'||witness_profile.avatar_name
      ),
      status='active',
      updated_at=now()
    where id=created_post_id and owner_id=member_profile.user_id;
  end if;

  update public.onboarding_submissions set
    status='approved',
    witness_handle=witness_profile.avatar_name,
    witness_user_id=witness_profile.user_id,
    reviewer_id=reviewer,
    review_reason='Identity evidence and joint member-witness selfie manually approved',
    identity_document_verified_at=coalesce(identity_document_verified_at,now()),
    witness_selfie_verified_at=coalesce(witness_selfie_verified_at,now()),
    verified_at=coalesce(verified_at,now()),
    welcome_post_id=created_post_id,
    updated_at=now()
  where user_id=member_profile.user_id;

  if submission.status<>'approved' then
    insert into public.admin_audit(actor_id,action,target_type,target_id,detail)
    values(
      reviewer,
      'member-status',
      'profile',
      '@'||member_profile.avatar_name,
      jsonb_build_object('status','APPROVED','witnessHandle','@'||witness_profile.avatar_name)
    );
  end if;

  return jsonb_build_object(
    'userId',member_profile.user_id,
    'avatarName',member_profile.avatar_name,
    'welcomePostId',created_post_id,
    'shopSlug',created_shop_slug,
    'status','approved'
  );
end;
$$;

revoke all on function public.approve_people_member(text,uuid) from public,anon,authenticated;
grant execute on function public.approve_people_member(text,uuid) to service_role;
