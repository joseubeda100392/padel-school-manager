-- Rol «cobrador» (cashier): una persona del club que solo cobra mensualidades
-- y marca fianzas desde su pantalla «Caja». No entra al panel ni a nada más;
-- las rutas del panel ya solo aceptan admin/super_admin.
--
-- Para deshacerlo: no se puede quitar un valor de un enum; basta con no usarlo
-- (cambiar a esos usuarios a otro rol).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';

-- La tabla users tiene además una restricción de roles creada fuera de las
-- migraciones (users_role_check). Se rehace con el cobrador incluido. Va en
-- un segundo paso: ejecutar después del ALTER TYPE de arriba.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role::text IN ('student', 'coach', 'admin', 'super_admin', 'cashier'));
