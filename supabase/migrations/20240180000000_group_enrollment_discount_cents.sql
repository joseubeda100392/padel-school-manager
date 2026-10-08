-- Importe exacto descontado al marcar el check de descuento (ahora la mitad
-- de la cuota de cada alumno). Al quitar el descuento se suma este mismo
-- importe, así la cuota vuelve a su valor original sin recalcular nada.
-- NULL en descuentos aplicados antes de este cambio: esos se quitan con el
-- importe fijo del club (config.standard_discount_cents).
ALTER TABLE group_enrollments ADD COLUMN IF NOT EXISTS discount_cents integer CHECK (discount_cents IS NULL OR discount_cents >= 0);
