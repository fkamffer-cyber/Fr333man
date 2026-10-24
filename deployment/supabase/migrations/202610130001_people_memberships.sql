create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null,
  description text not null default '',
  currency text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  monthly_amount integer check (monthly_amount is null or monthly_amount > 0),
  benefit_selection_limit integer not null default 0 check (benefit_selection_limit >= 0),
  product_selection_limit integer not null default 0 check (product_selection_limit >= 0),
  paystack_plan_code text,
  enrollment_open boolean not null default true,
  billing_enabled boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not billing_enabled or (monthly_amount is not null and paystack_plan_code is not null))
);

create table public.membership_catalog_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  item_type text not null check (item_type in ('benefit','product')),
  title text not null,
  description text not null default '',
  external_product_ref text,
  fulfillment_note text not null default '',
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_plan_items (
  plan_id uuid not null references public.membership_plans(id) on delete cascade,
  catalog_item_id uuid not null references public.membership_catalog_items(id) on delete cascade,
  primary key (plan_id,catalog_item_id)
);

create table public.people_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  status text not null default 'draft' check (status in ('draft','pending_payment','active','past_due','cancel_at_period_end','cancelled')),
  paystack_customer_code text,
  paystack_subscription_code text unique,
  paystack_email_token text,
  paystack_reference text unique,
  current_period_start date,
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_selections (
  membership_id uuid not null references public.people_memberships(id) on delete cascade,
  catalog_item_id uuid not null references public.membership_catalog_items(id),
  selection_month date not null,
  created_at timestamptz not null default now(),
  primary key (membership_id,catalog_item_id,selection_month)
);

create table public.membership_payment_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  event_type text not null,
  membership_id uuid references public.people_memberships(id) on delete set null,
  paystack_reference text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.membership_plans enable row level security;
alter table public.membership_catalog_items enable row level security;
alter table public.membership_plan_items enable row level security;
alter table public.people_memberships enable row level security;
alter table public.membership_selections enable row level security;
alter table public.membership_payment_events enable row level security;

create trigger membership_plans_updated before update on public.membership_plans for each row execute function public.set_updated_at();
create trigger membership_catalog_updated before update on public.membership_catalog_items for each row execute function public.set_updated_at();
create trigger people_memberships_updated before update on public.people_memberships for each row execute function public.set_updated_at();

create policy "active membership plans are public" on public.membership_plans for select to anon,authenticated using (status='active');
create policy "active membership catalogue is public" on public.membership_catalog_items for select to anon,authenticated using (status='active');
create policy "active plan items are public" on public.membership_plan_items for select to anon,authenticated using (
  exists(select 1 from public.membership_plans p where p.id=plan_id and p.status='active')
);
create policy "people read own membership" on public.people_memberships for select to authenticated using (member_id=auth.uid());
create policy "people read own membership selections" on public.membership_selections for select to authenticated using (
  exists(select 1 from public.people_memberships m where m.id=membership_id and m.member_id=auth.uid())
);
create policy "stewards read membership payment events" on public.membership_payment_events for select to authenticated using (public.is_platform_steward());

revoke all on public.membership_plans,public.membership_catalog_items,public.membership_plan_items,public.people_memberships,public.membership_selections,public.membership_payment_events from anon,authenticated;
grant select on public.membership_plans,public.membership_catalog_items,public.membership_plan_items to anon,authenticated;
grant select on public.people_memberships,public.membership_selections,public.membership_payment_events to authenticated;

insert into public.membership_plans (slug,name,description,benefit_selection_limit,product_selection_limit,enrollment_open,billing_enabled,status)
values ('people-membership','People Membership','A monthly membership for People who want to support the community and choose practical benefits and products.',3,1,true,false,'active')
on conflict (slug) do nothing;

insert into public.membership_catalog_items (slug,item_type,title,description,fulfillment_note) values
  ('member-marketplace-benefit','benefit','Member marketplace access','Create a People shop, list approved products and manage marketplace enquiries.','Available while membership is active.'),
  ('project-collaboration-benefit','benefit','Project collaboration','Join open projects, accept tasks and publish progress from your People profile.','Subject to each project''s participation rules.'),
  ('monthly-community-session','benefit','Monthly community session','Join the monthly online People session and member question period.','Session details are sent to active members.'),
  ('profile-promotion-benefit','benefit','Profile and product promotion','Select one approved profile, cause or product for a community promotion slot.','Promotion timing and channel remain subject to review.'),
  ('featured-local-product','product','Featured local product','Choose one eligible product from the current monthly membership catalogue.','Availability, region and fulfilment are confirmed before dispatch.'),
  ('digital-learning-pack','product','Digital learning pack','Choose a downloadable learning pack from the current member collection.','Delivered to the verified membership email.')
on conflict (slug) do nothing;

insert into public.membership_plan_items (plan_id,catalog_item_id)
select p.id,i.id from public.membership_plans p cross join public.membership_catalog_items i
where p.slug='people-membership' and i.slug in ('member-marketplace-benefit','project-collaboration-benefit','monthly-community-session','profile-promotion-benefit','featured-local-product','digital-learning-pack')
on conflict do nothing;

create index idx_membership_catalog_status_type on public.membership_catalog_items(status,item_type);
create index idx_people_memberships_member_status on public.people_memberships(member_id,status);
create index idx_membership_selections_month on public.membership_selections(membership_id,selection_month);
