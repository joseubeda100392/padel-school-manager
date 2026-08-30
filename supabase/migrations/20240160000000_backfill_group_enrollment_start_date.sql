-- Rellena group_enrollments.start_date para las inscripciones activas que lo
-- tienen vacío. Sin esto, get_pending_payments() cae en enrolled_at (cuándo
-- se dio de alta el alumno en el sistema) como "desde cuándo debe dinero" —
-- si se matriculó a alumnos en agosto para una temporada que arranca en
-- septiembre, el sistema los reclama como pendientes de agosto aunque esa
-- clase no haya dado ni una sola sesión ese mes.
--
-- Mismo criterio "cuenta desde hoy" que ya usa la app al calcular la cuota:
-- si a la clase (por su día de la semana) le queda alguna sesión este mes
-- desde hoy, el mes de facturación es este mes; si no, el que viene.

with params as (
  select ((now() at time zone 'Europe/Madrid')::date) as today_madrid
)
update group_enrollments ge
set start_date = (
  case
    when exists (
      select 1 from generate_series(
        p.today_madrid,
        (date_trunc('month', p.today_madrid) + interval '1 month - 1 day')::date,
        interval '1 day'
      ) d
      where extract(dow from d) = extract(dow from (s.start_time at time zone 'Europe/Madrid'))
    )
    then date_trunc('month', p.today_madrid)::date
    else (date_trunc('month', p.today_madrid) + interval '1 month')::date
  end
)
from schedules s, params p
where s.id = ge.schedule_id
  and ge.status = 'active'
  and ge.start_date is null;
