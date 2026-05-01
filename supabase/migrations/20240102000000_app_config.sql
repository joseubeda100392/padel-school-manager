-- Tabla de configuración de la app (clave-valor)
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer y escribir configuración
CREATE POLICY "admins_all_app_config" ON app_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Habilitar Realtime para chat
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Valores por defecto
INSERT INTO app_config (key, value) VALUES
  ('pay_per_class_price', '1200'),
  ('classes_per_pack',    '10'),
  ('pack_price',          '9000'),
  ('school_name',         'Mi Escuela de Pádel')
ON CONFLICT (key) DO NOTHING;
