-- Ampliar RLS de app_config para admitir super_admin además de admin
DROP POLICY IF EXISTS "admins_all_app_config" ON app_config;

CREATE POLICY "admins_all_app_config" ON app_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  );

-- Insertar valores por defecto para las nuevas keys de configuración
INSERT INTO app_config (key, value) VALUES
  ('pay_per_class_price_60', '1200'),
  ('pay_per_class_price_90', '1500'),
  ('pack_price_60',          '9000'),
  ('classes_per_pack_60',    '10'),
  ('pack_price_90',          '12000'),
  ('classes_per_pack_90',    '10'),
  ('cancellation_hours',     '24')
ON CONFLICT (key) DO NOTHING;
