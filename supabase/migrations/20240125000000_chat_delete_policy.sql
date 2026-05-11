CREATE POLICY "chat_threads_delete" ON chat_threads FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.get_my_db_role() IN ('admin', 'super_admin')
  );
