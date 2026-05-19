-- Add club_id to chat_threads so admin can filter by club
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id);

-- Backfill from the thread owner's club
UPDATE chat_threads ct
SET club_id = u.club_id
FROM users u
WHERE ct.user_id = u.id
  AND u.club_id IS NOT NULL
  AND ct.club_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_threads_club_id ON chat_threads(club_id);
