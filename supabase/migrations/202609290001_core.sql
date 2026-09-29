-- Apply in a test Supabase project first. Back up an existing project before migrating.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',
  generations_used integer not null default 0,
  generations_limit integer not null default 3,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_ends_at timestamptz,
  renewal_at timestamptz,
  brand_brief jsonb not null default '{}'::jsonb,
  last_paid_invoice_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists plan text not null default 'free',
  add column if not exists generations_used integer not null default 0,
  add column if not exists generations_limit integer not null default 3,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists renewal_at timestamptz,
  add column if not exists brand_brief jsonb not null default '{}'::jsonb,
  add column if not exists last_paid_invoice_id text,
  add column if not exists created_at timestamptz not null default now();

-- Preserve the legacy renewal marker if this is an existing Orbact database.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'usage_reset_at'
  ) then
    execute 'update public.profiles set renewal_at = usage_reset_at
      where renewal_at is null and usage_reset_at is not null';
  end if;
end;
$$;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_id_idx
  on public.profiles(stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  input_type text not null,
  input_raw text not null,
  outputs jsonb,
  status text not null default 'pending',
  request_id uuid,
  brief jsonb,
  credit_reserved boolean not null default false,
  credit_refunded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generations
  add column if not exists title text,
  add column if not exists request_id uuid,
  add column if not exists brief jsonb,
  add column if not exists credit_reserved boolean not null default false,
  add column if not exists credit_refunded boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists generations_user_request_idx
  on public.generations(user_id, request_id) where request_id is not null;
create index if not exists generations_user_created_idx
  on public.generations(user_id, created_at desc);

create table if not exists public.stripe_paid_invoices (
  invoice_id text primary key,
  customer_id text not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  service text not null,
  challenge text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.publish_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  platform text not null check (platform in ('linkedin', 'x', 'instagram', 'facebook')),
  content text not null,
  thread jsonb,
  media_url text,
  scheduled_at timestamptz not null,
  delivery_mode text not null default 'manual' check (delivery_mode in ('manual', 'managed')),
  status text not null default 'planned' check (status in ('planned', 'queued', 'publishing', 'published', 'failed', 'needs_review')),
  external_post_id text,
  last_error text,
  approved_at timestamptz,
  dispatched_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists publish_queue_user_date_idx
  on public.publish_queue(user_id, scheduled_at);

create table if not exists public.publishing_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'x', 'instagram', 'facebook')),
  external_account_id text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, platform)
);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists orbact_create_profile on auth.users;
create trigger orbact_create_profile after insert or update of email on auth.users
for each row execute function public.create_profile_for_user();

insert into public.profiles(id, email)
select id, email from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.stripe_paid_invoices enable row level security;
alter table public.agency_inquiries enable row level security;
alter table public.publish_queue enable row level security;
alter table public.publishing_connections enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists generations_read_own on public.generations;
create policy generations_read_own on public.generations
for select to authenticated using ((select auth.uid()) = user_id);

-- Remove older policies that may permit client mutation before relying on this migration.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'generations', 'stripe_paid_invoices', 'agency_inquiries', 'publish_queue', 'publishing_connections')
      and policyname not in ('profiles_read_own', 'generations_read_own')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

revoke all on public.profiles, public.generations, public.stripe_paid_invoices, public.agency_inquiries, public.publish_queue, public.publishing_connections
  from anon, authenticated;
grant select on public.profiles, public.generations to authenticated;
grant all on public.profiles, public.generations, public.stripe_paid_invoices, public.agency_inquiries, public.publish_queue, public.publishing_connections to service_role;

create or replace function public.claim_due_posts(p_limit integer)
returns setof public.publish_queue
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with due as (
    select q.id from public.publish_queue q
    where q.status = 'queued' and q.delivery_mode = 'managed'
      and q.scheduled_at <= now()
    order by q.scheduled_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  )
  update public.publish_queue q
     set status = 'publishing', dispatched_at = now()
    from due
   where q.id = due.id
  returning q.*;
end;
$$;

revoke all on function public.claim_due_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_posts(integer) to service_role;

create or replace function public.reserve_generation(
  p_user_id uuid,
  p_request_id uuid,
  p_title text,
  p_input_type text,
  p_input_raw text,
  p_brief jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_generation public.generations%rowtype;
  v_stale integer;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;

  -- Recover credits from requests whose server process died before finishing.
  with stale as (
    update public.generations
       set status = 'failed', credit_refunded = true, updated_at = now()
     where user_id = p_user_id and status = 'pending'
       and credit_reserved and not credit_refunded
       and created_at < now() - interval '15 minutes'
    returning id
  ) select count(*) into v_stale from stale;
  if v_stale > 0 then
    update public.profiles
       set generations_used = greatest(0, generations_used - v_stale)
     where id = p_user_id;
  end if;

  select * into v_generation from public.generations
   where user_id = p_user_id and request_id = p_request_id;
  if found then
    return jsonb_build_object('state', v_generation.status,
      'id', v_generation.id, 'outputs', v_generation.outputs);
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.generations_used >= v_profile.generations_limit then
    return jsonb_build_object('state', 'limit');
  end if;

  insert into public.generations
    (user_id, request_id, title, input_type, input_raw, brief, status, credit_reserved)
  values
    (p_user_id, p_request_id, p_title, p_input_type, left(p_input_raw, 2000), p_brief, 'pending', true)
  returning * into v_generation;

  update public.profiles set generations_used = generations_used + 1 where id = p_user_id;
  return jsonb_build_object('state', 'reserved', 'id', v_generation.id);
end;
$$;

create or replace function public.finish_generation(
  p_user_id uuid,
  p_request_id uuid,
  p_outputs jsonb,
  p_success boolean
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_generation public.generations%rowtype;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  select * into v_generation from public.generations
   where user_id = p_user_id and request_id = p_request_id for update;
  if not found then raise exception 'Generation not found'; end if;
  if v_generation.status <> 'pending' then return v_generation.status; end if;

  if p_success then
    if p_outputs is null then raise exception 'Outputs required'; end if;
    update public.generations
       set outputs = p_outputs, status = 'complete', updated_at = now()
     where id = v_generation.id;
    return 'complete';
  end if;

  update public.generations
     set status = 'failed', credit_refunded = true, updated_at = now()
   where id = v_generation.id;
  if v_generation.credit_reserved and not v_generation.credit_refunded then
    update public.profiles
       set generations_used = greatest(0, generations_used - 1)
     where id = p_user_id;
  end if;
  return 'failed';
end;
$$;

create or replace function public.apply_paid_invoice(
  p_invoice_id text,
  p_customer_id text,
  p_subscription_id text,
  p_period_end timestamptz
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles
   where stripe_customer_id = p_customer_id for update;
  if not found then raise exception 'Billing profile not found'; end if;
  if v_profile.plan = 'free' or v_profile.stripe_subscription_id is distinct from p_subscription_id then
    return false;
  end if;
  insert into public.stripe_paid_invoices(invoice_id, customer_id, period_end)
  values (p_invoice_id, p_customer_id, p_period_end)
  on conflict (invoice_id) do nothing;
  if not found then return false; end if;
  if v_profile.renewal_at is null or p_period_end > v_profile.renewal_at then
    update public.profiles
       set generations_used = 0, renewal_at = p_period_end,
           last_paid_invoice_id = p_invoice_id
     where id = v_profile.id;
    return true;
  end if;
  return false;
end;
$$;

-- The old client-callable usage function must no longer grant credits.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'try_consume_generation'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end;
$$;

revoke all on function public.create_profile_for_user() from public, anon, authenticated;
revoke all on function public.reserve_generation(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_generation(uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.apply_paid_invoice(text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.finish_generation(uuid, uuid, jsonb, boolean) to service_role;
grant execute on function public.apply_paid_invoice(text, text, text, timestamptz) to service_role;

commit;
