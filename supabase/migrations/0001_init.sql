-- Jolog: esquema inicial. Rode com `supabase db push`.
create type user_role as enum ('cliente', 'equipe', 'admin');
create type service_type as enum ('cleaning', 'laundry', 'inspection');
create type booking_status as enum ('pending_payment','scheduled','awaiting_contact','in_progress','completed','canceled','refunded');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'cliente',
  name text not null default '',
  phone text,
  cpf_cnpj text,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  address text not null,
  condominium text,
  bedrooms smallint not null check (bedrooms in (2,3))
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  property_id uuid references properties(id),
  service_type service_type not null,
  status booking_status not null default 'pending_payment',
  starts_at timestamptz,            -- limpeza e vistoria; lavanderia usa laundry_details.desired_date
  ends_at timestamptz,
  duration_minutes int,
  price_cents int not null check (price_cents >= 0),
  assigned_staff uuid references profiles(id),
  hold_expires_at timestamptz,      -- reserva de 15 min enquanto pending_payment
  canceled_at timestamptz,
  refund_percent smallint,
  notes text,
  created_at timestamptz not null default now(),
  check (service_type = 'laundry' or (starts_at is not null and ends_at is not null)),
  check (starts_at is null or (starts_at at time zone 'America/Sao_Paulo')::time >= '08:00'),
  check (ends_at is null or (ends_at at time zone 'America/Sao_Paulo')::time <= '20:00')
);
create index on bookings (starts_at) where status in ('pending_payment','scheduled','in_progress');

create table laundry_details (
  booking_id uuid primary key references bookings(id) on delete cascade,
  cycles int not null check (cycles >= 1),
  desired_date date not null,
  contact_phone text,
  contact_status text not null default 'pending' check (contact_status in ('pending','contacted','confirmed','unavailable')),
  confirmed_date date
);

create table inspection_checklist_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  active boolean not null default true,
  position int not null default 0
);
create table inspection_selected_items (
  booking_id uuid not null references bookings(id) on delete cascade,
  item_id uuid references inspection_checklist_items(id),
  custom_label text,
  result text check (result in ('ok','problem')),
  result_note text,
  primary key (booking_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(custom_label, ''))
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  method text not null check (method in ('pix','link')),
  status text not null default 'pending' check (status in ('pending','paid','expired','refunded')),
  provider_id text unique,
  pix_copia_cola text,
  payment_link text,
  paid_at timestamptz
);
create table payment_events (event_id text primary key, received_at timestamptz not null default now());

create table invoices (
  booking_id uuid primary key references bookings(id) on delete cascade,
  external_id text,
  number text,
  status text not null default 'processing',
  pdf_path text,
  error text,
  updated_at timestamptz not null default now()
);

create table booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null check (kind in ('before','after')),
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table reviews (
  booking_id uuid primary key references bookings(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- RLS
create function current_role_is(r user_role) returns boolean language sql stable security definer as
$$ select exists (select 1 from profiles where id = auth.uid() and role = r) $$;
create function is_staff() returns boolean language sql stable security definer as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('equipe','admin')) $$;

alter table profiles enable row level security;
alter table properties enable row level security;
alter table bookings enable row level security;
alter table laundry_details enable row level security;
alter table inspection_checklist_items enable row level security;
alter table inspection_selected_items enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table invoices enable row level security;
alter table booking_photos enable row level security;
alter table reviews enable row level security;

create policy profiles_self on profiles for select using (id = auth.uid() or current_role_is('admin'));
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy properties_owner on properties for all using (owner_id = auth.uid() or current_role_is('admin')) with check (owner_id = auth.uid());
create policy bookings_customer on bookings for select using (customer_id = auth.uid());
create policy bookings_customer_insert on bookings for insert with check (customer_id = auth.uid() and status = 'pending_payment');
create policy bookings_staff on bookings for select using (current_role_is('admin') or assigned_staff = auth.uid());
create policy bookings_staff_update on bookings for update using (current_role_is('admin') or assigned_staff = auth.uid());
create policy laundry_customer on laundry_details for all using (exists (select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or current_role_is('admin') or b.assigned_staff = auth.uid())));
create policy checklist_read on inspection_checklist_items for select using (auth.uid() is not null);
create policy checklist_admin on inspection_checklist_items for all using (current_role_is('admin'));
create policy selected_items on inspection_selected_items for all using (exists (select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or current_role_is('admin') or b.assigned_staff = auth.uid())));
create policy payments_customer on payments for select using (exists (select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or current_role_is('admin'))));
create policy invoices_read on invoices for select using (exists (select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or current_role_is('admin'))));
create policy photos_read on booking_photos for select using (exists (select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or current_role_is('admin') or b.assigned_staff = auth.uid())));
create policy photos_staff_insert on booking_photos for insert with check (is_staff() and uploaded_by = auth.uid());
create policy reviews_customer on reviews for all using (exists (select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or current_role_is('admin')))) with check (exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid() and b.status = 'completed'));
-- payment_events: sem policy = so service role acessa.

insert into storage.buckets (id, name, public) values ('booking-photos','booking-photos',false), ('invoices','invoices',false) on conflict do nothing;
