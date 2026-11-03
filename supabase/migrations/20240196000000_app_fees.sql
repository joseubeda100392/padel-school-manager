-- Cuota mensual que cada club paga a ePadel School por usar la app, por transferencia.
-- app_fee_plans: desde qué mes y cuánto paga cada club. app_fee_payments: por mes,
-- cuándo avisó el club de la transferencia y cuándo la confirmamos.
-- RLS activado y sin políticas: solo el servidor (service role) lee y escribe, porque
-- la tabla clubs la editan los admins desde el navegador y no deben poder marcarse
-- una cuota como pagada.
create table if not exists public.app_fee_plans (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  start_month date not null check (extract(day from start_month) = 1),
  amount numeric(10,2) not null check (amount > 0),
  -- Plazo del primer cobro cuando no coincide con el día 5 del mes de inicio
  -- (R3 empezó en octubre pero se le avisó en noviembre).
  first_due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.app_fee_payments (
  club_id uuid not null references public.clubs(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  notified_at timestamptz,
  paid_at timestamptz,
  amount numeric(10,2),
  primary key (club_id, month)
);

alter table public.app_fee_plans enable row level security;
alter table public.app_fee_payments enable row level security;

-- 99 € al mes, por adelantado. R3 debe desde octubre de 2026, con octubre y noviembre
-- hasta el 05/11/2026; X7 PINTO empieza en diciembre de 2026.
insert into public.app_fee_plans (club_id, start_month, amount, first_due_date) values
  ('c60abb4b-2cff-4a97-9d3a-491146920b9a', '2026-10-01', 99, '2026-11-05'),
  ('6f3c0990-3981-423d-b2ca-f520fd6ceb78', '2026-12-01', 99, null)
on conflict (club_id) do nothing;
