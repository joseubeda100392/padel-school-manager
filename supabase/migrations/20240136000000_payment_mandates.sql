-- Domiciliaciones bancarias (Redsys COF - Credential on File)
CREATE TABLE IF NOT EXISTS payment_mandates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  redsys_identifier TEXT,             -- token devuelto por Redsys tras primer pago
  amount_cents    INT NOT NULL,
  day_of_month    INT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  status          TEXT NOT NULL DEFAULT 'pending_auth'
                    CHECK (status IN ('pending_auth','active','paused','cancelled')),
  last_charged_at TIMESTAMPTZ,
  next_charge_at  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_mandates_user_id_idx    ON payment_mandates(user_id);
CREATE INDEX IF NOT EXISTS payment_mandates_club_id_idx    ON payment_mandates(club_id);
CREATE INDEX IF NOT EXISTS payment_mandates_charge_idx     ON payment_mandates(status, next_charge_at);

-- RLS: admin y super_admin leen/modifican mandatos de su club
ALTER TABLE payment_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read mandates"
  ON payment_mandates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','super_admin')
        AND (u.club_id = payment_mandates.club_id OR u.role = 'super_admin')
    )
  );

CREATE POLICY "admin write mandates"
  ON payment_mandates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','super_admin')
        AND (u.club_id = payment_mandates.club_id OR u.role = 'super_admin')
    )
  );
