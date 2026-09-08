-- La fuga real de secretos de `clubs` no era falta de RLS ni de una
-- política correcta (ya había dos: una hecha en el panel de Supabase sin
-- pasar por migraciones, y la que reaplicamos en 20240170) — el problema
-- eran DOS políticas adicionales, también creadas directo en el panel,
-- nunca vistas en el código: "clubs_public_search" (rol anon) y
-- "clubs_public_read" (todos los roles), ambas con condición is_active =
-- true, exponiendo TODAS las columnas — incluidas redsys_secret_key y las
-- credenciales de Playtomic — a cualquiera. Comprobado que ninguna función
-- real de la app depende de ellas (no hay buscador público de clubes).

DROP POLICY IF EXISTS "clubs_public_search" ON clubs;
DROP POLICY IF EXISTS "clubs_public_read" ON clubs;
