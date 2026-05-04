-- ─────────────────────────────────────────────────────────────────────────────
-- REVISIÓN COMPLETA DE POLÍTICAS RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── USERS ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_admin_all" ON users;
DROP POLICY IF EXISTS "users_authenticated_read" ON users;

CREATE POLICY "users_authenticated_read" ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_admin_all" ON users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── LEVELS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "levels_authenticated_read" ON levels;
DROP POLICY IF EXISTS "levels_admin_write" ON levels;
DROP POLICY IF EXISTS "levels_admin_update" ON levels;
DROP POLICY IF EXISTS "levels_admin_delete" ON levels;

CREATE POLICY "levels_authenticated_read" ON levels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "levels_admin_write" ON levels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "levels_admin_update" ON levels FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "levels_admin_delete" ON levels FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── USER_LEVELS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_levels_self_read" ON user_levels;
DROP POLICY IF EXISTS "user_levels_admin_write" ON user_levels;

CREATE POLICY "user_levels_self_read" ON user_levels FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY "user_levels_admin_write" ON user_levels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── COURTS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "courts_authenticated_read" ON courts;
DROP POLICY IF EXISTS "courts_admin_write" ON courts;
DROP POLICY IF EXISTS "courts_admin_update" ON courts;
DROP POLICY IF EXISTS "courts_admin_delete" ON courts;

CREATE POLICY "courts_authenticated_read" ON courts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "courts_admin_write" ON courts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "courts_admin_update" ON courts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "courts_admin_delete" ON courts FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── SCHEDULES ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedules_authenticated_read" ON schedules;
DROP POLICY IF EXISTS "schedules_admin_write" ON schedules;
DROP POLICY IF EXISTS "schedules_admin_update" ON schedules;
DROP POLICY IF EXISTS "schedules_admin_delete" ON schedules;

CREATE POLICY "schedules_authenticated_read" ON schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "schedules_admin_write" ON schedules FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY "schedules_admin_update" ON schedules FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY "schedules_admin_delete" ON schedules FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

-- ─── BOOKINGS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_admin_all" ON bookings;
DROP POLICY IF EXISTS "bookings_student_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_student_update" ON bookings;

CREATE POLICY "bookings_admin_all" ON bookings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY "bookings_student_insert" ON bookings FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "bookings_student_update" ON bookings FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ─── CLASS_BAG ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "class_bag_self_read" ON class_bag;
DROP POLICY IF EXISTS "class_bag_admin_all" ON class_bag;

CREATE POLICY "class_bag_self_read" ON class_bag FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "class_bag_admin_all" ON class_bag FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── BAG_TRANSACTIONS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bag_transactions_self_read" ON bag_transactions;
DROP POLICY IF EXISTS "bag_transactions_admin_write" ON bag_transactions;

CREATE POLICY "bag_transactions_self_read" ON bag_transactions FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "bag_transactions_admin_write" ON bag_transactions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payments_self_read" ON payments;
DROP POLICY IF EXISTS "payments_admin_all" ON payments;

CREATE POLICY "payments_self_read" ON payments FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "payments_admin_all" ON payments FOR ALL
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
DROP POLICY IF EXISTS "material_levels_authenticated_read" ON material_levels;
DROP POLICY IF EXISTS "material_levels_admin_write" ON material_levels;
DROP POLICY IF EXISTS "material_levels_admin_delete" ON material_levels;

CREATE POLICY "material_levels_authenticated_read" ON material_levels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "material_levels_admin_write" ON material_levels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "material_levels_admin_delete" ON material_levels FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

-- ─── CHAT ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_threads_insert" ON chat_threads;
DROP POLICY IF EXISTS "chat_threads_admin_update" ON chat_threads;
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;

CREATE POLICY "chat_threads_insert" ON chat_threads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_threads_admin_update" ON chat_threads FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_admin_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_self_update" ON notifications;

CREATE POLICY "notifications_admin_insert" ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role::text IN ('admin', 'super_admin'))
  );

CREATE POLICY "notifications_self_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
