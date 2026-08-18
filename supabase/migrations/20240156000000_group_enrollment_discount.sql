-- Marca explícita de si la cuota de esta inscripción tiene aplicado el
-- descuento estándar del club — se guarda como estado propio en vez de
-- inferirse comparando precios, para que el check no se desincronice al
-- recargar la página (caso real: alumno único en su grupo, o mayoría del
-- grupo ya con descuento, hacía que el precio "normal" calculado por
-- mayoría coincidiera con el ya descontado).
ALTER TABLE group_enrollments ADD COLUMN IF NOT EXISTS discount_applied boolean NOT NULL DEFAULT false;
