create table public.product_channel_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('facebook','gumtree','ebay','bobshop','takealot')),
  channel_category text not null,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','approved','publishing','listed','needs_attention','expired','sold','removed')),
  advert_title text not null check (char_length(advert_title) between 3 and 140),
  advert_description text not null check (char_length(advert_description) between 10 and 5000),
  external_listing_id text,
  external_url text,
  approved_at timestamptz,
  published_at timestamptz,
  renew_after timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,channel)
);

create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('freeland','facebook','gumtree','ebay','bobshop','takealot','whatsapp')),
  buyer_name text not null check (char_length(buyer_name) between 2 and 120),
  contact_method text not null default 'platform' check (contact_method in ('platform','whatsapp','email','phone')),
  contact_value text not null default '',
  stage text not null default 'new' check (stage in ('new','contacted','interested','negotiating','payment_pending','won','lost')),
  last_message text not null default '',
  next_follow_up_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_channel_listings enable row level security;
alter table public.sales_leads enable row level security;
create policy "people read own channel listings" on public.product_channel_listings for select to authenticated using (owner_id=auth.uid());
create policy "people read own sales leads" on public.sales_leads for select to authenticated using (owner_id=auth.uid());
revoke all on public.product_channel_listings,public.sales_leads from anon,authenticated;
grant select on public.product_channel_listings,public.sales_leads to authenticated;
create trigger product_channel_listings_updated before update on public.product_channel_listings for each row execute function public.set_updated_at();
create trigger sales_leads_updated before update on public.sales_leads for each row execute function public.set_updated_at();
create index idx_channel_listings_owner_status on public.product_channel_listings(owner_id,status,updated_at desc);
create index idx_channel_listings_renewal on public.product_channel_listings(owner_id,renew_after) where status='listed';
create index idx_sales_leads_owner_stage on public.sales_leads(owner_id,stage,updated_at desc);
create index idx_sales_leads_follow_up on public.sales_leads(owner_id,next_follow_up_at) where stage not in ('won','lost');
