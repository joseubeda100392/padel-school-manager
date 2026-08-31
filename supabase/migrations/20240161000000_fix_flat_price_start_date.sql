-- Corrige el backfill anterior (20240160000000) para las inscripciones de
-- cuota mensual plana (sin tarifa por clase): el criterio "le queda una
-- sesión este mes" solo tiene sentido cuando el precio está prorrateado por
-- ocurrencia (con_pista/sin_pista/clase suelta) — para una cuota fija de mes
-- completo, cobrar el mes entero por un solo día suelto a final de mes no
-- tiene sentido. Aquí se usa el mismo umbral de 5 días que el resto del
-- sistema (DAYS_THRESHOLD en lib/billing-cycle.ts) para mandatos recurrentes.

with params as (
  select ((now() at time zone 'Europe/Madrid')::date) as today_madrid
)
update group_enrollments ge
set start_date = (
  case
    when (date_trunc('month', p.today_madrid) + interval '1 month - 1 day')::date - p.today_madrid < 5
    then (date_trunc('month', p.today_madrid) + interval '1 month')::date
    else date_trunc('month', p.today_madrid)::date
  end
)
from params p
where ge.status = 'active'
  and ge.court_pricing is null
  and ge.price_per_class_cents is null;
