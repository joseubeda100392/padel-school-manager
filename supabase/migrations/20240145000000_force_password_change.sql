-- Añade flag para forzar cambio de contraseña temporal en el primer acceso.
-- Los usuarios existentes quedan en false (ya tienen contraseña establecida).
-- Los nuevos usuarios se crean con true explícitamente desde la API.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;
