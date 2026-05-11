-- 1. Remove self-insert policy on notifications (privilege escalation)
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

-- 2. Restrict Realtime channel subscriptions to user-scoped topics
-- Topic convention: "notifications:{user_id}" or "user:{user_id}"
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only subscribe to own channels" ON realtime.messages;
CREATE POLICY "Users can only subscribe to own channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('%' || auth.uid()::text)
  OR realtime.topic() LIKE 'public:%'
);

DROP POLICY IF EXISTS "Users can only broadcast to own channels" ON realtime.messages;
CREATE POLICY "Users can only broadcast to own channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE ('%' || auth.uid()::text)
);