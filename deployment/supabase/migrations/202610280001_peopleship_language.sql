-- Keep the existing database identifiers stable while changing all public copy
-- from "membership" to the community's preferred "peopleship" terminology.
update public.membership_plans
set
  name = 'FR333MAN Peopleship',
  description = replace(replace(description, 'Membership', 'Peopleship'), 'membership', 'peopleship'),
  updated_at = now()
where slug = 'people-membership';

update public.membership_catalog_items
set
  title = case
    when slug = 'member-marketplace-benefit' then 'People marketplace access'
    else title
  end,
  description = replace(replace(description, 'Membership', 'Peopleship'), 'membership', 'peopleship'),
  fulfillment_note = replace(replace(fulfillment_note, 'Membership', 'Peopleship'), 'membership', 'peopleship'),
  updated_at = now()
where
  description ilike '%membership%'
  or fulfillment_note ilike '%membership%'
  or slug = 'member-marketplace-benefit';
