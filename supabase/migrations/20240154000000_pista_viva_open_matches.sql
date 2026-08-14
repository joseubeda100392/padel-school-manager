-- ============================================================
-- PISTA VIVA v2 — Detección de partidos abiertos (API oficial Playtomic)
-- Reemplaza el mecanismo de creación de partidos (API no oficial) por
-- detección de partidos ya existentes que necesitan jugadores, con
-- opt-in explícito por usuario (nunca automático, nunca desde el
-- import masivo de jugadores de Playtomic).
-- ============================================================

-- Nivel real de Playtomic (0-7) del usuario, sincronizado desde su propio
-- perfil enlazado — nunca desde el import masivo de jugadores del club.
ALTER TABLE users ADD COLUMN IF NOT EXISTS playtomic_player_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS playtomic_level numeric;

-- Opt-in explícito y propio para Pista Viva — por defecto false para
-- todo el mundo. Solo se activa cuando el usuario enlaza su perfil.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pista_viva_optin boolean NOT NULL DEFAULT false;

-- Un registro por partido de Playtomic ya avisado, para no repetir el
-- aviso en cada pasada del cron.
CREATE TABLE IF NOT EXISTS pista_viva_open_match_alerts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  playtomic_match_id  text NOT NULL,
  court_name          text,
  slot_datetime       timestamptz NOT NULL,
  level_min           numeric,
  level_max           numeric,
  notified_user_ids   uuid[] NOT NULL DEFAULT '{}',
  participants_at_send int,
  status              text NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','recovered','lost')),
  created_at          timestamptz DEFAULT now(),
  resolved_at         timestamptz,
  UNIQUE (club_id, playtomic_match_id)
);

CREATE INDEX IF NOT EXISTS pista_viva_open_match_alerts_status_idx
  ON pista_viva_open_match_alerts(club_id, status);

ALTER TABLE pista_viva_open_match_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pista_viva_open_match_alerts_admin_read"
  ON pista_viva_open_match_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','super_admin')
        AND (u.club_id = pista_viva_open_match_alerts.club_id OR u.role = 'super_admin')
    )
  );
