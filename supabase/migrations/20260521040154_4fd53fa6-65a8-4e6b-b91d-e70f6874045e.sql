
-- Ensure RLS is on (it normally is by default for realtime.messages)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any earlier permissive policy we may have created previously
DROP POLICY IF EXISTS "realtime_user_scoped_topics" ON realtime.messages;

-- Only allow reading messages for channel topics that end with the user's own id.
-- Frontend channels MUST be named like '<resource>:<auth.uid()>'.
CREATE POLICY "realtime_user_scoped_topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'postgres_changes'
    AND topic LIKE '%:' || auth.uid()::text
  );
