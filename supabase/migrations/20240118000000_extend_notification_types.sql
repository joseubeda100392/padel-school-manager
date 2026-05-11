-- Ampliar el enum para notificaciones de la nueva funcionalidad
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'spot_available';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_reminder';

-- Permitir que el alumno marque sus propias notificaciones como leídas
CREATE POLICY "notifications_self_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
