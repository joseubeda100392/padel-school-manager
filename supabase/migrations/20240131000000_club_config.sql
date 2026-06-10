-- Per-club configuration (prices, school name, cancellation policy)
-- Replaces global app_config table for multi-club support
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{
  "pay_per_class_price_60": 1200,
  "pay_per_class_price_90": 1500,
  "pack_price_60": 9000,
  "classes_per_pack_60": 10,
  "pack_price_90": 12000,
  "classes_per_pack_90": 10,
  "cancellation_hours": 24
}'::jsonb;

-- Backfill from app_config into each club's config column
UPDATE clubs
SET config = jsonb_build_object(
  'pay_per_class_price_60', COALESCE((SELECT value::int FROM app_config WHERE key = 'pay_per_class_price_60'), 1200),
  'pay_per_class_price_90', COALESCE((SELECT value::int FROM app_config WHERE key = 'pay_per_class_price_90'), 1500),
  'pack_price_60',           COALESCE((SELECT value::int FROM app_config WHERE key = 'pack_price_60'), 9000),
  'classes_per_pack_60',     COALESCE((SELECT value::int FROM app_config WHERE key = 'classes_per_pack_60'), 10),
  'pack_price_90',           COALESCE((SELECT value::int FROM app_config WHERE key = 'pack_price_90'), 12000),
  'classes_per_pack_90',     COALESCE((SELECT value::int FROM app_config WHERE key = 'classes_per_pack_90'), 10),
  'cancellation_hours',      COALESCE((SELECT value::int FROM app_config WHERE key = 'cancellation_hours'), 24)
)
WHERE config IS NULL OR config = '{}'::jsonb;
