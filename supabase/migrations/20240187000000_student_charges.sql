-- Cargos sueltos: un cobro a un alumno que no es la cuota de un grupo (p. ej.
-- la cuota de un mes de un grupo que ya ha dejado, material, una inscripción).
-- El club lo crea desde la ficha del alumno; el alumno lo paga con tarjeta
-- desde su app o el club lo marca pagado en efectivo o datáfono.
--
-- RLS activado y SIN políticas: solo el servidor (clave de servicio) lo lee y
-- lo escribe, siempre comprobando el club y el rol de quien llama.
--
-- Solo añade cosas: un valor nuevo del tipo de pago y una tabla nueva.

ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'manual_charge';

CREATE TABLE IF NOT EXISTS student_charges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept      text NOT NULL CHECK (char_length(concept) BETWEEN 2 AND 120),
  amount_cents integer NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 1000000),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_method  text CHECK (paid_method IN ('card', 'cash', 'card_terminal')),
  payment_id   uuid REFERENCES payments(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);
CREATE INDEX IF NOT EXISTS student_charges_student_idx ON student_charges (student_id, status);
CREATE INDEX IF NOT EXISTS student_charges_club_idx ON student_charges (club_id, status);
ALTER TABLE student_charges ENABLE ROW LEVEL SECURITY;
