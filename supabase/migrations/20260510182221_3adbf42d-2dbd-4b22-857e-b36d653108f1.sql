
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "auth read profiles" on public.profiles for select to authenticated using (true);
create policy "user upsert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "user update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size text,
  price numeric not null default 0,
  waiting_time text,
  stock_status text not null default 'in_stock',
  category text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "auth all products" on public.products for all to authenticated using (true) with check (true);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

-- customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "auth all customers" on public.customers for all to authenticated using (true) with check (true);
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no serial,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  extra_fee numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  delivery_note text,
  order_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "auth all orders" on public.orders for all to authenticated using (true) with check (true);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

-- order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric not null default 0,
  quantity integer not null default 1,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
create policy "auth all order_items" on public.order_items for all to authenticated using (true) with check (true);
create index on public.order_items(order_id);

-- settings (single row)
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  business_name text default 'My Case',
  currency text default 'KS',
  default_waiting_time text default '3-5 days',
  tax_percent numeric default 0,
  service_fee numeric default 0,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "auth all settings" on public.settings for all to authenticated using (true) with check (true);
create trigger settings_updated before update on public.settings for each row execute function public.set_updated_at();

insert into public.settings (business_name) values ('My Case');
