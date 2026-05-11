-- Add email_confirmed column to track pending user registrations
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed boolean NOT NULL DEFAULT true;

-- Existing users are already confirmed
UPDATE users SET email_confirmed = true;
