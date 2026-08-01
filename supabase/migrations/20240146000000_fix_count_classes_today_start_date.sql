-- count_classes_today matched recurring schedules by day-of-week only, with no
-- check that the schedule had actually started (start_time) or hadn't already
-- ended (recurrence_end_date). This made "Clases hoy" on the admin dashboard
-- count classes from clubs whose season hasn't started yet.

CREATE OR REPLACE FUNCTION count_classes_today(p_club_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint
  FROM schedules
  WHERE is_active = true
    AND (p_club_id IS NULL OR club_id = p_club_id)
    AND (
      (recurrence = 'none' AND start_time::date = CURRENT_DATE)
      OR (
        recurrence IN ('weekly', 'biweekly')
        AND EXTRACT(DOW FROM start_time) = EXTRACT(DOW FROM CURRENT_DATE)
        AND start_time::date <= CURRENT_DATE
        AND (recurrence_end_date IS NULL OR recurrence_end_date >= CURRENT_DATE)
      )
    )
$$;
