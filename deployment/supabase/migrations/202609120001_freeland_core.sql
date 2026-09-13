create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_name text not null unique check (char_length(avatar_name) between 3 and 40),
  display_name text,
  region text not null default 'Randburg',
  member_type text not null default 'profile' check (member_type in ('profile','project','administration')),
  trust_status text not null default 'unverified' check (trust_status in ('unverified','pending_review','approved','suspended')),
  platform_role text not null default 'member' check (platform_role in ('member','project_member','ethics_committee','steward')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  witness_handle text,
  identity_consent_at timestamptz,
  witness_consent_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  fee_acknowledged_at timestamptz,
  status text not null default 'draft' check (status in ('draft','pending_identity_review','approved','rejected')),
  reviewer_id uuid references auth.users(id),
  review_reason text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.community_records (
  id bigint generated always as identity primary key,
  entity text not null check (entity in ('post','project','task','product','promotion','support','consent','dispute','broadcast')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft','active','pending_review','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  personal_message text not null check (char_length(personal_message) <= 500),
  source_url text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'unclaimed' check (status in ('unclaimed','claimed','revoked','expired')),
  claimed_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create table public.inventory (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  name text not null,
  stock integer not null default 0 check (stock >= 0),
  compliance_status text not null default 'pending_review' check (compliance_status in ('pending_review','permitted','blocked')),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,sku)
);

create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.onboarding_submissions enable row level security;
alter table public.community_records enable row level security;
alter table public.invitations enable row level security;
alter table public.inventory enable row level security;
alter table public.admin_audit enable row level security;

create or replace function public.is_platform_steward(check_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where user_id=check_user and platform_role in ('steward','ethics_committee') and trust_status='approved') $$;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger onboarding_updated before update on public.onboarding_submissions for each row execute function public.set_updated_at();
create trigger community_updated before update on public.community_records for each row execute function public.set_updated_at();
create trigger inventory_updated before update on public.inventory for each row execute function public.set_updated_at();

create policy "public approved profiles" on public.profiles for select to anon,authenticated using (is_public and trust_status='approved');
create policy "people read own profile" on public.profiles for select to authenticated using (user_id=auth.uid());
create policy "people read own onboarding" on public.onboarding_submissions for select to authenticated using (user_id=auth.uid());
create policy "active community content is public" on public.community_records for select to anon,authenticated using (status='active');
create policy "people read own content" on public.community_records for select to authenticated using (owner_id=auth.uid());
create policy "inviter reads invitations" on public.invitations for select to authenticated using (inviter_id=auth.uid());
create policy "people read own inventory" on public.inventory for select to authenticated using (owner_id=auth.uid());
create policy "stewards read audit" on public.admin_audit for select to authenticated using (public.is_platform_steward());

revoke all on public.profiles,public.onboarding_submissions,public.community_records,public.invitations,public.inventory,public.admin_audit from anon,authenticated;
grant select on public.profiles,public.community_records to anon,authenticated;
grant select on public.onboarding_submissions,public.invitations,public.inventory,public.admin_audit to authenticated;
grant execute on function public.is_platform_steward(uuid) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('private-vault','private-vault',false,8000000,array['application/pdf','image/jpeg','image/png','image/webp','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict (id) do nothing;
create policy "people upload to own vault" on storage.objects for insert to authenticated with check (bucket_id='private-vault' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "people read own vault" on storage.objects for select to authenticated using (bucket_id='private-vault' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "people delete own vault" on storage.objects for delete to authenticated using (bucket_id='private-vault' and (storage.foldername(name))[1]=auth.uid()::text);

create index idx_community_records_owner_entity on public.community_records(owner_id,entity);
create index idx_community_records_active on public.community_records(status,updated_at desc) where status='active';
create index idx_invitations_inviter on public.invitations(inviter_id,created_at desc);
create index idx_inventory_owner_status on public.inventory(owner_id,status);
