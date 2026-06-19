-- ============================================================
-- PISTA VIVA — Módulo de detección y notificación de pistas libres en Playtomic
-- ============================================================

-- Columnas Playtomic en clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS playtomic_email text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS playtomic_password text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS playtomic_tenant_id text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS playtomic_booking_url text;

-- Opt-in WhatsApp por usuario (Pista Viva)
ALTER TABLE users ADD COLUMN IF NOT EXISTS pista_viva_whatsapp boolean NOT NULL DEFAULT false;

-- Campañas de Pista Viva
CREATE TABLE IF NOT EXISTS pista_viva_campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  playtomic_match_id  text,
  playtomic_match_url text,
  court_name          text NOT NULL,
  resource_id         text NOT NULL,
  slot_datetime       timestamptz NOT NULL,
  duration_minutes    int NOT NULL DEFAULT 90,
  target_level_id     uuid REFERENCES levels(id),
  message             text,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','converted','closed')),
  players_needed      int NOT NULL DEFAULT 4,
  players_joined      int NOT NULL DEFAULT 0,
  click_count         int NOT NULL DEFAULT 0,
  billed              boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz DEFAULT now(),
  sent_at             timestamptz,
  last_checked_at     timestamptz,
  closed_at           timestamptz,
  UNIQUE (club_id, resource_id, slot_datetime)
);

CREATE INDEX IF NOT EXISTS pista_viva_campaigns_club_status_idx
  ON pista_viva_campaigns(club_id, status);
CREATE INDEX IF NOT EXISTS pista_viva_campaigns_sent_idx
  ON pista_viva_campaigns(status, slot_datetime)
  WHERE status = 'sent';

-- Clics de atribución
CREATE TABLE IF NOT EXISTS pista_viva_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES pista_viva_campaigns(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id),
  ip           text,
  clicked_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pista_viva_clicks_campaign_idx
  ON pista_viva_clicks(campaign_id);

-- RLS campañas
ALTER TABLE pista_viva_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pista_viva_admin_read"
  ON pista_viva_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','super_admin')
        AND (u.club_id = pista_viva_campaigns.club_id OR u.role = 'super_admin')
    )
  );

CREATE POLICY "pista_viva_admin_write"
  ON pista_viva_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','super_admin')
        AND (u.club_id = pista_viva_campaigns.club_id OR u.role = 'super_admin')
    )
  );

-- RLS clics
ALTER TABLE pista_viva_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pista_viva_clicks_admin_read"
  ON pista_viva_clicks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pista_viva_campaigns c
      JOIN users u ON u.id = auth.uid()
      WHERE c.id = pista_viva_clicks.campaign_id
        AND u.role IN ('admin','super_admin')
        AND (u.club_id = c.club_id OR u.role = 'super_admin')
    )
  );

-- Feature flag en clubs existentes
UPDATE clubs
  SET features = COALESCE(features, '{}'::jsonb) || '{"enable_pista_viva": false}'::jsonb
  WHERE features IS NULL OR NOT (features ? 'enable_pista_viva');

-- Tipo de notificación
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pista_viva';

-- Función para incrementar click_count de forma segura
CREATE OR REPLACE FUNCTION increment_pista_viva_click(campaign_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE pista_viva_campaigns
  SET click_count = click_count + 1
  WHERE id = campaign_id;
$$;
