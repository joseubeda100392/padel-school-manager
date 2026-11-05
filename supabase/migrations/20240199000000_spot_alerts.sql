-- El alumno puede apagar los avisos de huecos libres (y volver a encenderlos)
-- desde su app. Por defecto encendidos, como hasta ahora. Los avisos de su
-- lista de espera le siguen llegando siempre.
--
-- Para deshacerlo: ALTER TABLE users DROP COLUMN IF EXISTS spot_alerts;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spot_alerts boolean NOT NULL DEFAULT true;
