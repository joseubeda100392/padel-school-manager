-- Permite marcar a un monitor (role='coach') como también alumno del club,
-- para que la misma cuenta pueda entrar tanto al panel de monitor como al
-- de alumno (clases, cuota, bolsa, etc.) sin necesitar un segundo login.
alter table users
  add column if not exists also_student boolean not null default false;
