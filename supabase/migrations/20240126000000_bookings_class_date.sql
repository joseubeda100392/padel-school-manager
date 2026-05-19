-- Add class_date to bookings for one-time spot reservations
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS class_date date;

-- Replace the old unique(schedule_id, student_id) constraint
-- with two partial indexes: one for group bookings (no date) and one for spot bookings (with date)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_schedule_id_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_group_unique
  ON bookings(schedule_id, student_id)
  WHERE class_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_spot_unique
  ON bookings(schedule_id, student_id, class_date)
  WHERE class_date IS NOT NULL;
