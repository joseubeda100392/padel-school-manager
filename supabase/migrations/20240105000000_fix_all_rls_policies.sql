-- ─────────────────────────────────────────────────────────────────────────────
-- REVISIÓN COMPLETA DE POLÍTICAS RLS
-- Añade WITH CHECK explícito, super_admin y políticas faltantes en todas las tablas
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── USERS ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_admin_all" ON users;

CREATE POLICY "users_admin_all" ON users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- Los coaches y alumnos pueden leer cualquier perfil (necesario para mostrar nombres en clases)
CREATE POLICY IF NOT EXISTS "users_authenticated_read" ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── LEVELS ──────────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "levels_authenticated_read" ON levels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "levels_admin_write" ON levels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "levels_admin_update" ON levels FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "levels_admin_delete" ON levels FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── USER_LEVELS ─────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "user_levels_self_read" ON user_levels FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY IF NOT EXISTS "user_levels_admin_write" ON user_levels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── COURTS ──────────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "courts_authenticated_read" ON courts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "courts_admin_write" ON courts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "courts_admin_update" ON courts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "courts_admin_delete" ON courts FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── SCHEDULES ───────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "schedules_authenticated_read" ON schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "schedules_admin_write" ON schedules FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY IF NOT EXISTS "schedules_admin_update" ON schedules FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY IF NOT EXISTS "schedules_admin_delete" ON schedules FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

-- ─── BOOKINGS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_admin_all" ON bookings;

CREATE POLICY "bookings_admin_all" ON bookings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

-- Los alumnos pueden insertar y cancelar sus propias reservas
CREATE POLICY IF NOT EXISTS "bookings_student_insert" ON bookings FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY IF NOT EXISTS "bookings_student_update" ON bookings FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ─── CLASS_BAG ───────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "class_bag_self_read" ON class_bag FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "class_bag_admin_all" ON class_bag FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── BAG_TRANSACTIONS ────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "bag_transactions_self_read" ON bag_transactions FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "bag_transactions_admin_write" ON bag_transactions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "payments_self_read" ON payments FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "payments_admin_all" ON payments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── MATERIALS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "materials_admin_all" ON materials;

CREATE POLICY "materials_admin_all" ON materials FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── MATERIAL_LEVELS ─────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "material_levels_authenticated_read" ON material_levels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "material_levels_admin_write" ON material_levels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "material_levels_admin_delete" ON material_levels FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── CHAT ────────────────────────────────────────────────────────────────────
-- Insertar mensajes: el propio usuario o admin/coach
CREATE POLICY IF NOT EXISTS "chat_messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

-- Insertar hilos: el propio usuario
CREATE POLICY IF NOT EXISTS "chat_threads_insert" ON chat_threads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admin puede actualizar hilos (marcar como resuelto)
CREATE POLICY IF NOT EXISTS "chat_threads_admin_update" ON chat_threads FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "notifications_admin_insert" ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY IF NOT EXISTS "notifications_self_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
