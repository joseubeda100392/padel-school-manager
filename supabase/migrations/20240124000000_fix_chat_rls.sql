-- Replace chat RLS policies to use get_my_db_role() (SECURITY DEFINER, no recursion)
-- The old policies queried users table inside chat_threads policy → potential recursion

DROP POLICY IF EXISTS "chat_threads_participant" ON chat_threads;
DROP POLICY IF EXISTS "chat_messages_participant" ON chat_messages;

CREATE POLICY "chat_threads_participant" ON chat_threads FOR SELECT
  USING (
    user_id = auth.uid()
    OR recipient_id = auth.uid()
    OR public.get_my_db_role() IN ('admin', 'super_admin', 'coach')
  );

CREATE POLICY "chat_messages_participant" ON chat_messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR public.get_my_db_role() IN ('admin', 'super_admin', 'coach')
    OR EXISTS (
      SELECT 1 FROM chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );
