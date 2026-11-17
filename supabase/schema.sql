-- DigiDecide Real Estate: land verification marketplace, phases 1-3
-- Run this once in a NEW Supabase project: Dashboard > SQL Editor > New query > paste > Run.
-- It creates the tables, security rules (row level security) and storage buckets.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- types
do $$ begin
  create type public.user_role as enum ('buyer','seller','admin','lawyer','surveyor');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.property_type as enum ('residential_plot','agricultural','converted_na','approved_layout','commercial_plot');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.listing_status as enum ('draft','pending','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.availability as enum ('available','under_offer','sold');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.verification_status as enum ('not_requested','requested','pending_review','verified','discrepancy','unable');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.check_status as enum ('not_started','pending_review','verified','discrepancy','unable');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'buyer',
  seller_verified boolean not null default false,
  city text not null default '',
  created_at timestamptz not null default now()
);

-- Phone numbers live apart from profiles so other users never read them.
create table if not exists public.contact_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','lawyer','surveyor') from public.profiles where id = auth.uid()), false)
$$;

-- New sign-ups become a buyer or a seller. Admin, lawyer and surveyor roles are given by an admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role','buyer');
begin
  if r not in ('buyer','seller') then r := 'buyer'; end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),120), r::public.user_role)
  on conflict (id) do nothing;
  insert into public.contact_details (user_id, phone)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'phone',''),20))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only an admin can change role or seller verification.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.seller_verified := old.seller_verified;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------------------------------------------------------------- properties
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '',
  type public.property_type not null,
  price numeric(14,0) not null check (price >= 0),
  size_value numeric(12,2) not null check (size_value > 0),
  size_unit text not null default 'sq_yards' check (size_unit in ('sq_yards','sq_feet','cents','acres')),
  survey_number text not null default '',
  village text not null default '',
  mandal text not null default '',
  district text not null default '',
  state text not null default 'Andhra Pradesh',
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  approvals text[] not null default '{}',
  approval_ref text not null default '',
  road_access text not null default '',
  listing_status public.listing_status not null default 'pending',
  availability public.availability not null default 'available',
  verification_status public.verification_status not null default 'not_requested',
  featured boolean not null default false,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_search on public.properties (listing_status, district, type, price);
create index if not exists properties_seller on public.properties (seller_id);

-- Sellers cannot approve their own listing, feature it or set its verification result.
-- Any edit by a seller sends an approved listing back for review.
create or replace function public.guard_property() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_admin() or auth.uid() is null or current_setting('app.system_update', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.seller_id := auth.uid();
    new.listing_status := case when new.listing_status = 'draft' then 'draft' else 'pending' end;
    new.featured := false;
    new.verification_status := 'not_requested';
    new.review_note := '';
  else
    new.seller_id := old.seller_id;
    new.featured := old.featured;
    new.verification_status := old.verification_status;
    new.review_note := old.review_note;
    if new.listing_status not in ('draft','pending') then new.listing_status := old.listing_status; end if;
    if old.listing_status in ('approved','rejected') and (
         new.title, new.description, new.type, new.price, new.size_value, new.size_unit, new.survey_number,
         new.village, new.mandal, new.district, new.lat, new.lng, new.approvals, new.approval_ref, new.road_access)
       is distinct from (
         old.title, old.description, old.type, old.price, old.size_value, old.size_unit, old.survey_number,
         old.village, old.mandal, old.district, old.lat, old.lng, old.approvals, old.approval_ref, old.road_access)
    then new.listing_status := 'pending'; end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_property on public.properties;
create trigger guard_property before insert or update on public.properties
  for each row execute function public.guard_property();

create or replace function public.try_uuid(t text) returns uuid
language sql immutable as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end
$$;

create or replace function public.can_see_property(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties p where p.id = pid and
    (p.listing_status = 'approved' or p.seller_id = auth.uid() or public.is_staff()))
$$;
create or replace function public.owns_property(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties p where p.id = pid and p.seller_id = auth.uid())
$$;

-- ---------------------------------------------------------------- media and documents
create table if not exists public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('photo','video')),
  path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists media_property on public.property_media (property_id, position);

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  doc_type text not null check (doc_type in ('sale_deed','link_documents','adangal_1b','passbook','ec','fmb_sketch','layout_approval','conversion_order','tax_receipt','other')),
  file_name text not null default '',
  path text not null,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected')),
  review_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists docs_property on public.property_documents (property_id);

create or replace function public.guard_document() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid(); new.review_status := 'pending'; new.review_note := '';
  else
    new.review_status := old.review_status; new.review_note := old.review_note;
    new.owner_id := old.owner_id; new.property_id := old.property_id; new.path := old.path;
  end if;
  return new;
end $$;
drop trigger if exists guard_document on public.property_documents;
create trigger guard_document before insert or update on public.property_documents
  for each row execute function public.guard_document();

-- ---------------------------------------------------------------- buyers
create table if not exists public.favourites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete cascade,
  buyer_name text not null default '',
  phone text not null default '',
  message text not null check (char_length(message) between 2 and 2000),
  wants_site_visit boolean not null default false,
  preferred_date date,
  status text not null default 'new' check (status in ('new','replied','visit_scheduled','closed')),
  seller_reply text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists enquiries_seller on public.enquiries (seller_id, created_at desc);
create index if not exists enquiries_buyer on public.enquiries (buyer_id, created_at desc);

create or replace function public.guard_enquiry() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.buyer_id := coalesce(auth.uid(), new.buyer_id);
    select seller_id into new.seller_id from public.properties where id = new.property_id;
    new.status := 'new'; new.seller_reply := '';
  elsif not public.is_admin() and auth.uid() is not null then
    new.property_id := old.property_id; new.buyer_id := old.buyer_id; new.seller_id := old.seller_id;
    if auth.uid() = old.buyer_id and auth.uid() is distinct from old.seller_id then
      new.status := old.status; new.seller_reply := old.seller_reply;
    else
      new.message := old.message; new.phone := old.phone; new.buyer_name := old.buyer_name;
      new.wants_site_visit := old.wants_site_visit; new.preferred_date := old.preferred_date;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_enquiry on public.enquiries;
create trigger guard_enquiry before insert or update on public.enquiries
  for each row execute function public.guard_enquiry();

-- ---------------------------------------------------------------- verification
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  requested_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'basic' check (kind in ('basic','expert','lawyer')),
  status text not null default 'requested' check (status in ('requested','assigned','in_review','completed','cancelled')),
  assigned_lawyer uuid references public.profiles(id) on delete set null,
  assigned_surveyor uuid references public.profiles(id) on delete set null,
  note text not null default '',
  staff_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vr_property on public.verification_requests (property_id);

create or replace function public.is_assigned(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.verification_requests r where r.property_id = pid
    and auth.uid() in (r.assigned_lawyer, r.assigned_surveyor) and r.status <> 'cancelled')
$$;

create or replace function public.guard_vrequest() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.requested_by := coalesce(auth.uid(), new.requested_by);
    if not public.is_admin() then
      new.status := 'requested'; new.assigned_lawyer := null; new.assigned_surveyor := null; new.staff_note := '';
    end if;
    perform set_config('app.system_update','on',true);
    update public.properties set verification_status = 'requested'
      where id = new.property_id and verification_status in ('not_requested','unable');
    perform set_config('app.system_update','off',true);
  elsif not public.is_admin() and auth.uid() is not null then
    new.property_id := old.property_id; new.requested_by := old.requested_by; new.kind := old.kind;
    new.assigned_lawyer := old.assigned_lawyer; new.assigned_surveyor := old.assigned_surveyor;
    if auth.uid() in (old.assigned_lawyer, old.assigned_surveyor) then
      if new.status not in ('in_review','completed') then new.status := old.status; end if;
      new.note := old.note;
    else
      new.staff_note := old.staff_note;
      if new.status <> 'cancelled' then new.status := old.status; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_vrequest on public.verification_requests;
create trigger guard_vrequest before insert or update on public.verification_requests
  for each row execute function public.guard_vrequest();

-- One row per property per point of the twelve-point verification.
create table if not exists public.verification_checks (
  property_id uuid not null references public.properties(id) on delete cascade,
  point smallint not null check (point between 1 and 12),
  status public.check_status not null default 'not_started',
  note text not null default '',
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (property_id, point)
);

create or replace function public.touch_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); return new; end $$;
drop trigger if exists touch_check on public.verification_checks;
create trigger touch_check before insert or update on public.verification_checks
  for each row execute function public.touch_check();

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.contact_details enable row level security;
alter table public.properties enable row level security;
alter table public.property_media enable row level security;
alter table public.property_documents enable row level security;
alter table public.favourites enable row level security;
alter table public.enquiries enable row level security;
alter table public.verification_requests enable row level security;
alter table public.verification_checks enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "contact self" on public.contact_details;
create policy "contact self" on public.contact_details for all
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "properties visible" on public.properties;
create policy "properties visible" on public.properties for select
  using (listing_status = 'approved' or seller_id = auth.uid() or public.is_staff());
drop policy if exists "properties insert by sellers" on public.properties;
create policy "properties insert by sellers" on public.properties for insert
  with check (auth.uid() is not null and public.my_role() in ('seller','admin'));
drop policy if exists "properties owner update" on public.properties;
create policy "properties owner update" on public.properties for update
  using (seller_id = auth.uid() or public.is_admin());
drop policy if exists "properties owner delete" on public.properties;
create policy "properties owner delete" on public.properties for delete
  using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "media visible" on public.property_media;
create policy "media visible" on public.property_media for select using (public.can_see_property(property_id));
drop policy if exists "media owner write" on public.property_media;
create policy "media owner write" on public.property_media for insert with check (public.owns_property(property_id) or public.is_admin());
drop policy if exists "media owner delete" on public.property_media;
create policy "media owner delete" on public.property_media for delete using (public.owns_property(property_id) or public.is_admin());

drop policy if exists "docs owner and staff" on public.property_documents;
create policy "docs owner and staff" on public.property_documents for select
  using (public.owns_property(property_id) or public.is_admin() or public.is_assigned(property_id));
drop policy if exists "docs owner insert" on public.property_documents;
create policy "docs owner insert" on public.property_documents for insert with check (public.owns_property(property_id) or public.is_admin());
drop policy if exists "docs review" on public.property_documents;
create policy "docs review" on public.property_documents for update
  using (public.is_admin() or public.is_assigned(property_id) or public.owns_property(property_id));
drop policy if exists "docs owner delete" on public.property_documents;
create policy "docs owner delete" on public.property_documents for delete using (public.owns_property(property_id) or public.is_admin());

drop policy if exists "favourites own" on public.favourites;
create policy "favourites own" on public.favourites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "enquiries parties" on public.enquiries;
create policy "enquiries parties" on public.enquiries for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
drop policy if exists "enquiries create" on public.enquiries;
create policy "enquiries create" on public.enquiries for insert
  with check (auth.uid() is not null and public.can_see_property(property_id) and not public.owns_property(property_id));
drop policy if exists "enquiries update" on public.enquiries;
create policy "enquiries update" on public.enquiries for update
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "vr parties" on public.verification_requests;
create policy "vr parties" on public.verification_requests for select
  using (requested_by = auth.uid() or public.owns_property(property_id) or public.is_admin()
         or auth.uid() in (assigned_lawyer, assigned_surveyor));
drop policy if exists "vr create" on public.verification_requests;
create policy "vr create" on public.verification_requests for insert
  with check (auth.uid() is not null and public.can_see_property(property_id));
drop policy if exists "vr update" on public.verification_requests;
create policy "vr update" on public.verification_requests for update
  using (requested_by = auth.uid() or public.is_admin() or auth.uid() in (assigned_lawyer, assigned_surveyor));

drop policy if exists "checks visible" on public.verification_checks;
create policy "checks visible" on public.verification_checks for select using (public.can_see_property(property_id));
drop policy if exists "checks staff write" on public.verification_checks;
create policy "checks staff write" on public.verification_checks for insert
  with check (public.is_admin() or public.is_assigned(property_id));
drop policy if exists "checks staff update" on public.verification_checks;
create policy "checks staff update" on public.verification_checks for update
  using (public.is_admin() or public.is_assigned(property_id));

-- ---------------------------------------------------------------- storage
-- property-media is public (listing photos and videos). property-documents is private.
-- Files are stored as <user id>/<property id>/<file name>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('property-media','property-media', true, 52428800)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit)
values ('property-documents','property-documents', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "media upload own folder" on storage.objects;
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media delete own folder" on storage.objects;
create policy "media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'property-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "docs upload own folder" on storage.objects;
create policy "docs upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "docs read owner and staff" on storage.objects;
create policy "docs read owner and staff" on storage.objects for select to authenticated
  using (bucket_id = 'property-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    or public.is_assigned(public.try_uuid((storage.foldername(name))[2]))));
drop policy if exists "docs delete owner" on storage.objects;
create policy "docs delete owner" on storage.objects for delete to authenticated
  using (bucket_id = 'property-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------- first admin
-- After you sign up on the site, make yourself admin by running this with your email:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
