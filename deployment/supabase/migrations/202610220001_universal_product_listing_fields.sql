alter table public.products add column if not exists subcategory text not null default '';
alter table public.products add column if not exists brand text not null default '';
alter table public.products add column if not exists model text not null default '';
alter table public.products add column if not exists gtin text not null default '';
alter table public.products add column if not exists tags text[] not null default '{}'::text[];
alter table public.products add column if not exists availability text not null default 'in_stock'
  check (availability in ('single_item','in_stock','out_of_stock'));
alter table public.products add column if not exists listing_location text not null default 'Randburg';
alter table public.products add column if not exists delivery_options text[] not null default '{}'::text[];

comment on column public.products.gtin is 'Universal barcode or product identifier used by channels that require one.';
comment on column public.products.delivery_options is 'Allowed values: public_meetup, door_pickup, door_dropoff, shipping.';
