-- Cancelar una reserva borraba también su fila de payments (por la FK
-- RESTRICT que obligaba a borrarla antes de poder borrar la reserva),
-- destruyendo el rastro de auditoría de un cobro real de Redsys.
--
-- Cambiamos la FK a ON DELETE SET NULL: al borrar la reserva, el pago se
-- queda en la tabla (con su importe, fecha y redsys_order_id intactos),
-- solo se desvincula de la reserva ya inexistente.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_booking_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
