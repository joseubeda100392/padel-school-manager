ALTER TABLE clubs ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "enable_60min": true,
  "enable_90min": true,
  "enable_payments": true,
  "enable_spots": true,
  "enable_bag": true,
  "enable_chat": true,
  "enable_materials": true,
  "enable_objectives": true
}'::jsonb;
