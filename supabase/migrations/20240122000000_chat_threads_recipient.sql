-- Add thread_type to distinguish admin vs coach conversations
-- Add recipient_id to point to the specific coach for coach threads
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS thread_type text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES users(id);

-- Existing threads are all admin type (default handles it)

CREATE INDEX IF NOT EXISTS idx_chat_threads_recipient_id ON chat_threads(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_type ON chat_threads(thread_type);
