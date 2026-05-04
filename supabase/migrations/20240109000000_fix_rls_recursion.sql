-- Corrige la recursión infinita en las políticas RLS de la tabla users.
-- El problema: users_admin_all hacía SELECT FROM users para comprobar el rol,
-- lo que disparaba la misma política → bucle infinito.
-- Solución: función SECURITY DEFINER que lee el rol sin pasar por RLS.

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = auth.uid()
$$;

-- users
DROP POLICY IF EXISTS "users_admin_all" ON users;
CREATE POLICY "users_admin_all" ON users FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_my_role() IN ('admin', 'super_admin'));

-- levels
DROP POLICY IF EXISTS "levels_admin_write"   ON levels;
DROP POLICY IF EXISTS "levels_admin_update"  ON levels;
DROP POLICY IF EXISTS "levels_admin_delete"  ON levels;
CREATE POLICY "levels_admin_write"  ON levels FOR INSERT WITH CHECK (get_my_role() IN ('admin','super_admin'));
CREATE POLICY "levels_admin_update" ON levels FOR UPDATE USING (get_my_role() IN ('admin','super_admin')) WITH CHECK (get_my_role() IN ('admin','super_admin'));
CREATE POLICY "levels_admin_delete" ON levels FOR DELETE USING (get_my_role() IN ('admin','super_admin'));

-- courts
DROP POLICY IF EXISTS "courts_admin_write"   ON courts;
DROP POLICY IF EXISTS "courts_admin_update"  ON courts;
DROP POLICY IF EXISTS "courts_admin_delete"  ON courts;
CREATE POLICY "courts_admin_write"  ON courts FOR INSERT WITH CHECK (get_my_role() IN ('admin','super_admin'));
CREATE POLICY "courts_admin_update" ON courts FOR UPDATE USING (get_my_role() IN ('admin','super_admin')) WITH CHECK (get_my_role() IN ('admin','super_admin'));
CREATE POLICY "courts_admin_delete" ON courts FOR DELETE USING (get_my_role() IN ('admin','super_admin'));

-- schedules
DROP POLICY IF EXISTS "schedules_admin_write"   ON schedules;
DROP POLICY IF EXISTS "schedules_admin_update"  ON schedules;
DROP POLICY IF EXISTS "schedules_admin_delete"  ON schedules;
CREATE POLICY "schedules_admin_write"  ON schedules FOR INSERT WITH CHECK (get_my_role() IN ('admin','super_admin','coach'));
CREATE POLICY "schedules_admin_update" ON schedules FOR UPDATE USING (get_my_role() IN ('admin','super_admin','coach')) WITH CHECK (get_my_role() IN ('admin','super_admin','coach'));
CREATE POLICY "schedules_admin_delete" ON schedules FOR DELETE USING (get_my_role() IN ('admin','super_admin','coach'));

-- bookings
DROP POLICY IF EXISTS "bookings_admin_all" ON bookings;
CREATE POLICY "bookings_admin_all" ON bookings FOR ALL
  USING (get_my_role() IN ('admin','super_admin','coach'))
  WITH CHECK (get_my_role() IN ('admin','super_admin','coach'));

-- class_bag
DROP POLICY IF EXISTS "class_bag_self_read" ON class_bag;
DROP POLICY IF EXISTS "class_bag_admin_all" ON class_bag;
CREATE POLICY "class_bag_self_read" ON class_bag FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','super_admin'));
CREATE POLICY "class_bag_admin_all" ON class_bag FOR ALL USING (get_my_role() IN ('admin','super_admin')) WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- bag_transactions
DROP POLICY IF EXISTS "bag_transactions_self_read"   ON bag_transactions;
DROP POLICY IF EXISTS "bag_transactions_admin_write" ON bag_transactions;
CREATE POLICY "bag_transactions_self_read"   ON bag_transactions FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','super_admin'));
CREATE POLICY "bag_transactions_admin_write" ON bag_transactions FOR INSERT WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- payments
DROP POLICY IF EXISTS "payments_self_read" ON payments;
DROP POLICY IF EXISTS "payments_admin_all" ON payments;
CREATE POLICY "payments_self_read" ON payments FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','super_admin'));
CREATE POLICY "payments_admin_all" ON payments FOR ALL USING (get_my_role() IN ('admin','super_admin')) WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- materials
DROP POLICY IF EXISTS "materials_admin_all" ON materials;
CREATE POLICY "materials_admin_all" ON materials FOR ALL
  USING (get_my_role() IN ('admin','super_admin'))
  WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- user_levels
DROP POLICY IF EXISTS "user_levels_self_read"   ON user_levels;
DROP POLICY IF EXISTS "user_levels_admin_write" ON user_levels;
CREATE POLICY "user_levels_self_read"   ON user_levels FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','super_admin','coach'));
CREATE POLICY "user_levels_admin_write" ON user_levels FOR INSERT WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- material_levels
DROP POLICY IF EXISTS "material_levels_admin_write"  ON material_levels;
DROP POLICY IF EXISTS "material_levels_admin_delete" ON material_levels;
CREATE POLICY "material_levels_admin_write"  ON material_levels FOR INSERT WITH CHECK (get_my_role() IN ('admin','super_admin'));
CREATE POLICY "material_levels_admin_delete" ON material_levels FOR DELETE USING (get_my_role() IN ('admin','super_admin'));

-- chat_threads
DROP POLICY IF EXISTS "chat_threads_admin_update" ON chat_threads;
CREATE POLICY "chat_threads_admin_update" ON chat_threads FOR UPDATE
  USING (get_my_role() IN ('admin','super_admin'))
  WITH CHECK (get_my_role() IN ('admin','super_admin'));

-- notifications
DROP POLICY IF EXISTS "notifications_admin_insert" ON notifications;
CREATE POLICY "notifications_admin_insert" ON notifications FOR INSERT
  WITH CHECK (get_my_role() IN ('admin','super_admin'));
