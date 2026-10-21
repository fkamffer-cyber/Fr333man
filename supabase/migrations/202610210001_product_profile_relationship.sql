alter table public.products
  drop constraint if exists products_owner_id_fkey;

alter table public.products
  add constraint products_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(user_id)
  on delete cascade;
