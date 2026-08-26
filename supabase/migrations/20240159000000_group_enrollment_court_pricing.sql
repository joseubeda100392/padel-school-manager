-- Clasifica cada inscripción de grupo fijo como "con pista" o "sin pista"
-- (módulo de Validación de clases, urbanizaciones) — para poder recalcular
-- price_per_class_cents solo, a partir de la tarifa del club, en vez de
-- teclearlo a mano cada vez.
alter table group_enrollments
  add column if not exists court_pricing text
  check (court_pricing is null or court_pricing in ('con_pista', 'sin_pista'));
