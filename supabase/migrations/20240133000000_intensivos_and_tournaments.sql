-- Schedules: intensivo type, price, and group
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'regular' CHECK (type IN ('regular', 'intensivo'));
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS price_cents INTEGER;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS intensivo_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_schedules_intensivo_group ON schedules (intensivo_group_id) WHERE intensivo_group_id IS NOT NULL;

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tournament_date DATE NOT NULL,
  location TEXT,
  max_players INTEGER NOT NULL DEFAULT 16,
  price_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finished')),
  allowed_level_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, student_id)
);

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

-- Tournaments: visible to members of the same club
DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
CREATE POLICY "tournaments_select" ON tournaments
  FOR SELECT USING (
    club_id IN (SELECT club_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "tournaments_admin" ON tournaments;
CREATE POLICY "tournaments_admin" ON tournaments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Tournament registrations
DROP POLICY IF EXISTS "treg_select" ON tournament_registrations;
CREATE POLICY "treg_select" ON tournament_registrations
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "treg_insert" ON tournament_registrations;
CREATE POLICY "treg_insert" ON tournament_registrations
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "treg_delete" ON tournament_registrations;
CREATE POLICY "treg_delete" ON tournament_registrations
  FOR DELETE USING (student_id = auth.uid());

-- Add allowed_level_ids to existing tournaments table (if created before this migration)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS allowed_level_ids UUID[] NOT NULL DEFAULT '{}';
