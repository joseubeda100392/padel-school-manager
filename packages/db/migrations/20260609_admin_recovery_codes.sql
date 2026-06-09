-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-06-09
-- Descripción: Tabla para códigos de recuperación MFA de administradores

CREATE TABLE admin_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Solo service role puede acceder (sin políticas RLS = acceso solo desde servidor)
ALTER TABLE admin_recovery_codes ENABLE ROW LEVEL SECURITY;
