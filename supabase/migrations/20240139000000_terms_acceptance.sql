-- Add terms acceptance timestamp to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
