-- Lu & Co. Navidad — base de datos (proyecto de Supabase SEPARADO del tablero).
-- Clientes (anónimos): ven precios y colores, crean pedidos y consultan el suyo por código.
-- Panel (correos en la tabla admins): ven y cambian todo.

create table if not exists public.admins (email text primary key);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  prices jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  color text primary key,
  grams_left int not null default 200,
  available boolean not null default true,
  sort int not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now(),
  adult_name text not null check (char_length(adult_name) between 2 and 60),
  phone text not null check (char_length(phone) between 7 and 20),
  payment text,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  total int not null check (total >= 0),
  status text not null default 'Nuevo'
    check (status in ('Nuevo','Aceptado','Pagado','Imprimiendo','Listo','Entregado','Cancelado')),
  status_dates jsonb not null default '{}'::jsonb,
  grams int not null default 0,
  merma int not null default 0,
  notes text not null default '',
  pay_link text not null default ''
);

alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;

-- admins: nadie la lee desde la app (is_admin() es security definer)
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy inventory_read on public.inventory for select to anon, authenticated using (true);
create policy inventory_admin on public.inventory for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_select on public.orders for select to authenticated using (public.is_admin());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_delete on public.orders for delete to authenticated using (public.is_admin());
-- Sin insert directo: los clientes crean pedidos solo con create_order().

-- Códigos al azar (LU-7KQ3M): no se pueden adivinar y protegen los nombres que van en las esferas.
create or replace function public.nuevo_codigo() returns text
language plpgsql volatile set search_path = public as $$
declare v text; abc constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
begin
  loop
    select 'LU-' || string_agg(substr(abc, 1 + floor(random() * length(abc))::int, 1), '') into v from generate_series(1, 5);
    exit when not exists (select 1 from public.orders where code = v);
  end loop;
  return v;
end $$;
revoke all on function public.nuevo_codigo() from public, anon, authenticated;

create or replace function public.create_order(p_adult text, p_phone text, p_payment text, p_items jsonb, p_total int)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if p_adult is null or char_length(trim(p_adult)) < 2 then raise exception 'Falta el nombre del adulto'; end if;
  if p_phone is null or char_length(regexp_replace(p_phone, '\D', '', 'g')) < 7 then raise exception 'Falta el teléfono'; end if;
  v_code := public.nuevo_codigo();
  insert into public.orders (code, adult_name, phone, payment, items, total, status_dates)
  values (v_code, trim(p_adult), trim(p_phone), p_payment, p_items, p_total, jsonb_build_object('Nuevo', current_date));
  return v_code;
end $$;

-- Lo que ve el cliente con su código: sin nombre ni teléfono.
create or replace function public.order_status(p_code text)
returns table (code text, status text, status_dates jsonb, total int, items jsonb, created_at timestamptz, payment text, pay_link text)
language sql stable security definer set search_path = public as $$
  select o.code, o.status, o.status_dates, o.total, o.items, o.created_at, o.payment, o.pay_link
  from public.orders o where o.code = upper(trim(p_code));
$$;

revoke all on function public.create_order(text, text, text, jsonb, int) from public;
revoke all on function public.order_status(text) from public;
grant execute on function public.create_order(text, text, text, jsonb, int) to anon, authenticated;
grant execute on function public.order_status(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

insert into public.settings (id, prices) values
  (1, '{"p4":60,"cv":25,"rollo":276,"gramos":11.5,"otros":5,"porTanda":4}')
on conflict (id) do nothing;

insert into public.inventory (color, sort) values
  ('rojo',0),('verde',1),('amarillo',2),('morado',3),('arcoiris',4),('naranja',5),('azul',6),('blanco',7)
on conflict (color) do nothing;

-- Después de crear las cuentas del panel en Authentication:
-- insert into public.admins (email) values ('<correo del panel>');

-- Avisos en vivo al panel cuando llega un pedido (17-nov). Realtime respeta RLS: solo admins reciben.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
