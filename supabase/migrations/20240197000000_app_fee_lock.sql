-- Si la cuota de la app lleva más de 10 días vencida (desde el día 16) y el club no
-- ha avisado de la transferencia, el panel del admin queda bloqueado para cambios.
-- Activado en todos los clubs; el super admin puede quitárselo a uno desde Clubes.
alter table public.app_fee_plans
  add column if not exists lock_when_overdue boolean not null default true;
