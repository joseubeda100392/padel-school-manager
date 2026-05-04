-- Índices de rendimiento para las columnas filtradas con más frecuencia

-- bookings: filtros más comunes en schedule.tsx y student detail
CREATE INDEX IF NOT EXISTS idx_bookings_student_id        ON bookings (student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule_id       ON bookings (schedule_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student_status    ON bookings (student_id, status);

-- schedules: filtros en vista admin y mobile
CREATE INDEX IF NOT EXISTS idx_schedules_club_id          ON schedules (club_id);
CREATE INDEX IF NOT EXISTS idx_schedules_coach_id         ON schedules (coach_id);
CREATE INDEX IF NOT EXISTS idx_schedules_is_active        ON schedules (is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_level_id         ON schedules (level_id);

-- users: dashboard, listado de alumnos, RLS policies
CREATE INDEX IF NOT EXISTS idx_users_club_id              ON users (club_id);
CREATE INDEX IF NOT EXISTS idx_users_role                 ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_role_is_active       ON users (role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_club_role            ON users (club_id, role);

-- payments: historial por alumno y dashboard de cobros
CREATE INDEX IF NOT EXISTS idx_payments_user_id           ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status            ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_user_status       ON payments (user_id, status);

-- user_levels: historial de niveles por alumno
CREATE INDEX IF NOT EXISTS idx_user_levels_user_id        ON user_levels (user_id);

-- bag_transactions: historial de bolsa por alumno
CREATE INDEX IF NOT EXISTS idx_bag_transactions_user_id   ON bag_transactions (user_id);

-- class_bag: lookup directo por alumno
CREATE INDEX IF NOT EXISTS idx_class_bag_user_id          ON class_bag (user_id);

-- materials: filtro por publicación
CREATE INDEX IF NOT EXISTS idx_materials_is_published     ON materials (is_published);

-- chat: lookup de hilos por usuario y estado
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id       ON chat_threads (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status        ON chat_threads (status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id    ON chat_messages (thread_id);

-- group_enrollments: usado en home de alumno para cuotas pendientes
CREATE INDEX IF NOT EXISTS idx_group_enrollments_student  ON group_enrollments (student_id, status);
