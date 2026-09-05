-- Clase particular (1 a 1): un schedule de clase única (recurrence='none')
-- marcado como is_private lleva un flujo de precio y visibilidad distinto
-- al de una clase suelta normal — ver /api/payments/create-order y
-- /api/admin/bookings/spot.
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
