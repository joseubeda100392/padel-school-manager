-- Credenciales Redsys por club (TPV propio de cada club)
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS redsys_merchant_code     text,
  ADD COLUMN IF NOT EXISTS redsys_secret_key        text,
  ADD COLUMN IF NOT EXISTS redsys_merchant_terminal text DEFAULT '001',
  ADD COLUMN IF NOT EXISTS redsys_env               text DEFAULT 'test';
