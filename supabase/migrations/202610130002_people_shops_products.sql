alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists skills text[] not null default '{}'::text[];
alter table public.profiles add column if not exists website_url text;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 3 and 100),
  description text not null default '',
  region text not null default 'Randburg',
  fulfilment_note text not null default '',
  returns_note text not null default '',
  status text not null default 'draft' check (status in ('draft','pending_review','active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,90}$'),
  sku text,
  name text not null check (char_length(name) between 3 and 140),
  description text not null check (char_length(description) between 10 and 3000),
  category text not null,
  condition text not null default 'new' check (condition in ('new','used','refurbished','digital','service')),
  price_amount integer not null check (price_amount >= 0),
  currency text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  stock integer not null default 0 check (stock >= 0),
  membership_eligible boolean not null default false,
  compliance_status text not null default 'pending_review' check (compliance_status in ('pending_review','permitted','blocked')),
  status text not null default 'draft' check (status in ('draft','pending_review','published','paused','sold_out','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,sku)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now()
);

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

create trigger shops_updated before update on public.shops for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create policy "active approved shops are public" on public.shops for select to anon,authenticated using (
  status='active' and exists(select 1 from public.profiles p where p.user_id=owner_id and p.is_public and p.trust_status='approved')
);
create policy "people read own shop" on public.shops for select to authenticated using (owner_id=auth.uid());
create policy "published permitted products are public" on public.products for select to anon,authenticated using (
  status='published' and compliance_status='permitted' and exists(select 1 from public.shops s where s.id=shop_id and s.status='active')
);
create policy "people read own products" on public.products for select to authenticated using (owner_id=auth.uid());
create policy "published product images are public" on public.product_images for select to anon,authenticated using (
  exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.compliance_status='permitted')
);
create policy "people read own product images" on public.product_images for select to authenticated using (owner_id=auth.uid());

revoke all on public.shops,public.products,public.product_images from anon,authenticated;
grant select on public.shops,public.products,public.product_images to anon,authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-media','product-media',true,8000000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "public reads product media" on storage.objects for select to anon,authenticated using (bucket_id='product-media');
create policy "people upload own product media" on storage.objects for insert to authenticated with check (bucket_id='product-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "people update own product media" on storage.objects for update to authenticated using (bucket_id='product-media' and owner_id=auth.uid()::text) with check (bucket_id='product-media' and owner_id=auth.uid()::text);
create policy "people delete own product media" on storage.objects for delete to authenticated using (bucket_id='product-media' and owner_id=auth.uid()::text);

create index idx_shops_status_slug on public.shops(status,slug);
create index idx_products_public on public.products(status,compliance_status,created_at desc);
create index idx_products_owner_status on public.products(owner_id,status,updated_at desc);
create index idx_product_images_product_order on public.product_images(product_id,display_order);
