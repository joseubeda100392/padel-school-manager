-- Extend payment_type enum with all values used in the application
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'single_class';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'fixed_group_month';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'tournament';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'intensivo_group';
