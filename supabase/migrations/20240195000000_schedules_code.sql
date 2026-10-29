-- Código con el que el club conoce cada grupo (p. ej. "GP015" en Pinto).
-- Opcional y solo informativo: sale en Clases → Cuadrante y se edita en la clase.
alter table public.schedules
  add column if not exists code text
  check (code is null or char_length(code) between 1 and 20);
