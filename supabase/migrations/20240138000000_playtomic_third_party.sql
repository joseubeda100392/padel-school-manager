-- Credenciales API oficial de Playtomic (terceros) para importar jugadores
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS playtomic_client_id text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS playtomic_client_secret text;
