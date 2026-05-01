-- ─────────────────────────────────────────────
-- MIGRACIÓN INICIAL: Padel School Manager
-- ─────────────────────────────────────────────

-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- ENUMS
create type user_role as enum ('student', 'coach', 'admin');
create type court_type as enum ('indoor', 'outdoor', 'covered');
create type recurrence_type as enum ('none', 'weekly', 'biweekly');
create type booking_status as enum ('confirmed', 'no_show', 'cancelled', 'pending');
create type booking_source as enum ('subscription', 'bag', 'pay_per_class');
create type payment_type as enum ('subscription', 'pay_per_class', 'class_pack');
create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type thread_status as enum ('active', 'resolved');
create type bag_transaction_type as enum ('credit', 'debit');
create type notification_type as enum (
  'booking_confirmed', 'booking_cancelled', 'class_reminder',
  'chat_message', 'level_updated', 'payment_succeeded', 'payment_failed'
);

-- USUARIOS
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  role user_role not null default 'student',
  name text not null,
  avatar_url text,
  phone text,
  stripe_customer_id text unique,
  is_active boolean not null default true,
  current_level_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NIVELES
create table levels (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  description text,
  color text not null default '#6366f1',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);

alter table users add constraint fk_users_level
  foreign key (current_level_id) references levels(id) on delete set null;

-- HISTORIAL DE NIVELES
create table user_levels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  level_id uuid not null references levels(id),
  assigned_by uuid not null,
  notes text,
  created_at timestamptz not null default now()
);

-- PISTAS
create table courts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type court_type not null default 'indoor',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- HORARIOS
create table schedules (
  id uuid primary key default uuid_generate_v4(),
  court_id uuid not null references courts(id),
  coach_id uuid not null references users(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  recurrence recurrence_type not null default 'weekly',
  max_students int not null default 4,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RESERVAS
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid not null references schedules(id),
  student_id uuid not null references users(id),
  status booking_status not null default 'confirmed',
  source booking_source not null default 'subscription',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_id, student_id)
);

-- BOLSA DE CLASES
create table class_bag (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references users(id) on delete cascade,
  balance int not null default 0,
  updated_at timestamptz not null default now()
);

create table bag_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  class_bag_id uuid not null references class_bag(id),
  delta int not null,
  type bag_transaction_type not null,
  reason text not null,
  booking_id uuid unique references bookings(id),
  created_at timestamptz not null default now()
);

-- PAGOS
create table payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  booking_id uuid unique references bookings(id),
  stripe_payment_intent_id text unique,
  stripe_subscription_id text unique,
  amount int not null,
  currency text not null default 'eur',
  type payment_type not null,
  status payment_status not null default 'pending',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHAT
create table chat_threads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  status thread_status not null default 'active',
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  sender_id uuid not null references users(id),
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- MATERIALES
create table materials (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  file_url text not null,
  file_size int,
  uploaded_by uuid not null references users(id),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table material_levels (
  material_id uuid not null references materials(id) on delete cascade,
  level_id uuid not null references levels(id) on delete cascade,
  primary key (material_id, level_id)
);

-- NOTIFICACIONES
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────

alter table users enable row level security;
alter table levels enable row level security;
alter table user_levels enable row level security;
alter table courts enable row level security;
alter table schedules enable row level security;
alter table bookings enable row level security;
alter table class_bag enable row level security;
alter table bag_transactions enable row level security;
alter table payments enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
alter table materials enable row level security;
alter table material_levels enable row level security;
alter table notifications enable row level security;

-- Políticas básicas (ampliar según necesidades)
-- Usuarios: cada usuario ve su propio registro; admin ve todo
create policy "users_self_read" on users for select using (auth.uid() = id);
create policy "users_admin_all" on users for all using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- Bookings: el alumno ve sus propias reservas
create policy "bookings_self_read" on bookings for select using (student_id = auth.uid());
create policy "bookings_admin_all" on bookings for all using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- Chat: los participantes del hilo ven sus mensajes
create policy "chat_threads_participant" on chat_threads for select using (
  user_id = auth.uid() or
  exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'coach'))
);
create policy "chat_messages_participant" on chat_messages for select using (
  sender_id = auth.uid() or
  exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid()) or
  exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'coach'))
);

-- Materiales: publicados son visibles para todos los autenticados
create policy "materials_authenticated_read" on materials for select
  using (auth.uid() is not null and is_published = true);
create policy "materials_admin_all" on materials for all using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- Notificaciones: cada usuario ve las suyas
create policy "notifications_self" on notifications for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- DATOS INICIALES
-- ─────────────────────────────────────────────

insert into levels (name, description, color, "order") values
  ('Iniciación', 'Jugadores que empiezan desde cero', '#6366f1', 1),
  ('Intermedio', 'Conocen la técnica básica del pádel', '#f59e0b', 2),
  ('Avanzado', 'Buen nivel técnico y táctico', '#10b981', 3),
  ('Competición', 'Nivel de torneos y competiciones', '#ef4444', 4);
