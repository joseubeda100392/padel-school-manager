-- Seguridad: limitar qué puede cambiar un admin de club en la tabla users.
--
-- La política "users_admin_own_club" deja a un admin modificar cualquier fila
-- de su club desde el navegador (con su sesión y la clave pública), sin límite
-- de columnas. Con la consola del navegador, un admin podía ponerse a sí mismo
-- role = 'super_admin' y ver y gestionar todos los clubs.
--
-- La pantalla de editar usuario cambia el rol desde el navegador (alumno,
-- monitor, admin), así que eso sigue permitido. Lo que se cierra, para quien
-- entra con sesión de la app y no es super admin:
--   · dar o quitar el rol super_admin;
--   · cambiarse el rol a uno mismo;
--   · cambiar el club de un usuario (moverlo, o moverse, a otro club).
--
-- El servidor de la app (clave de servicio) y el SQL Editor no tienen sesión
-- de usuario (auth.uid() es NULL) y siguen sin límites.

CREATE OR REPLACE FUNCTION guard_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR get_my_role() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'No se puede crear un super admin desde la app' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.role = 'super_admin') IS DISTINCT FROM (OLD.role = 'super_admin') THEN
    RAISE EXCEPTION 'No se puede dar ni quitar el rol de super admin' USING ERRCODE = '42501';
  END IF;

  IF NEW.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol' USING ERRCODE = '42501';
  END IF;

  IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'No se puede cambiar el club de un usuario desde la app' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_users_privileged_columns();
