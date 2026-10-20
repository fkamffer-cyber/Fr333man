alter table public.onboarding_submissions
  add column if not exists identity_document_path text,
  add column if not exists witness_selfie_path text,
  add column if not exists witness_selfie_verified_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists welcome_post_id bigint references public.community_records(id);

create or replace function public.approve_people_member(target_handle text, reviewer uuid)
returns table(user_id uuid, avatar_name text, welcome_post_id bigint, shop_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  member_profile public.profiles%rowtype;
  submission public.onboarding_submissions%rowtype;
  created_post_id bigint;
  created_shop_slug text;
begin
  select * into member_profile from public.profiles where profiles.avatar_name=replace(target_handle,'@','') for update;
  if member_profile.user_id is null then raise exception 'People profile not found'; end if;
  select * into submission from public.onboarding_submissions where onboarding_submissions.user_id=member_profile.user_id for update;
  if submission.witness_selfie_path is null or submission.witness_handle is null then
    raise exception 'A consented joint witness selfie and existing member handle are required before approval';
  end if;

  created_shop_slug := regexp_replace(lower(member_profile.avatar_name),'[^a-z0-9-]+','-','g');
  insert into public.shops(owner_id,slug,name,description,region,status)
  values(member_profile.user_id,created_shop_slug,coalesce(nullif(member_profile.display_name,''),member_profile.avatar_name)||' Shop','Products and offers from this People member.',member_profile.region,'active')
  on conflict(owner_id) do update set status='active',region=excluded.region,updated_at=now()
  returning slug into created_shop_slug;

  update public.profiles set trust_status='approved',is_public=true,updated_at=now() where profiles.user_id=member_profile.user_id;
  created_post_id := submission.welcome_post_id;
  if created_post_id is null then
    insert into public.community_records(entity,owner_id,title,data,status)
    values('post',member_profile.user_id,'Welcome @'||member_profile.avatar_name||' to the People community',jsonb_build_object('kind','member_welcome','body','A new People member has completed identity, liveness and joint member-witness verification.','memberName',coalesce(nullif(member_profile.display_name,''),member_profile.avatar_name),'handle','@'||member_profile.avatar_name,'profileUrl','/people/'||member_profile.avatar_name,'bioUrl','/people/'||member_profile.avatar_name||'#about','shopUrl','/shops/'||created_shop_slug,'witnessHandle',submission.witness_handle),'active')
    returning id into created_post_id;
  end if;

  update public.onboarding_submissions set status='approved',reviewer_id=reviewer,witness_selfie_verified_at=now(),verified_at=now(),welcome_post_id=created_post_id,updated_at=now() where onboarding_submissions.user_id=member_profile.user_id;
  return query select member_profile.user_id,member_profile.avatar_name,created_post_id,created_shop_slug;
end;
$$;

revoke all on function public.approve_people_member(text,uuid) from public,anon,authenticated;
grant execute on function public.approve_people_member(text,uuid) to service_role;
