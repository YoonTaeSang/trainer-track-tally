
-- 1. Fix goals trainer comment policy: correlated subquery
DROP POLICY IF EXISTS "Trainers/admins comment goals" ON public.goals;
CREATE POLICY "Trainers/admins comment goals" ON public.goals
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND user_id = (SELECT g.user_id FROM public.goals g WHERE g.id = goals.id)
);

-- 2. Schedules: members can only toggle nothing sensitive — restrict to no-op except keep policy minimal.
-- Pin attended, signature_url, signed_at, signature_requested to existing values.
DROP POLICY IF EXISTS "Members update own schedules" ON public.schedules;
CREATE POLICY "Members update own schedules" ON public.schedules
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = schedules.member_id AND m.user_id = auth.uid()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = schedules.member_id AND m.user_id = auth.uid())
  AND attended IS NOT DISTINCT FROM (SELECT s.attended FROM public.schedules s WHERE s.id = schedules.id)
  AND signature_url IS NOT DISTINCT FROM (SELECT s.signature_url FROM public.schedules s WHERE s.id = schedules.id)
  AND signed_at IS NOT DISTINCT FROM (SELECT s.signed_at FROM public.schedules s WHERE s.id = schedules.id)
  AND signature_requested IS NOT DISTINCT FROM (SELECT s.signature_requested FROM public.schedules s WHERE s.id = schedules.id)
  AND member_id = (SELECT s.member_id FROM public.schedules s WHERE s.id = schedules.id)
  AND date = (SELECT s.date FROM public.schedules s WHERE s.id = schedules.id)
  AND time = (SELECT s.time FROM public.schedules s WHERE s.id = schedules.id)
);

-- 3. workout_logs: members cannot overwrite trainer_memo, schedule_id, member_id, exercises
DROP POLICY IF EXISTS "Members update own workout_logs" ON public.workout_logs;
CREATE POLICY "Members update own workout_logs" ON public.workout_logs
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = workout_logs.member_id AND m.user_id = auth.uid()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = workout_logs.member_id AND m.user_id = auth.uid())
  AND trainer_memo = (SELECT w.trainer_memo FROM public.workout_logs w WHERE w.id = workout_logs.id)
  AND exercises = (SELECT w.exercises FROM public.workout_logs w WHERE w.id = workout_logs.id)
  AND schedule_id = (SELECT w.schedule_id FROM public.workout_logs w WHERE w.id = workout_logs.id)
  AND member_id = (SELECT w.member_id FROM public.workout_logs w WHERE w.id = workout_logs.id)
);

-- 4. members: fix self-join correlation
DROP POLICY IF EXISTS "Members update own memo only" ON public.members;
CREATE POLICY "Members update own memo only" ON public.members
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = (SELECT m.status FROM public.members m WHERE m.id = members.id)
  AND total_sessions = (SELECT m.total_sessions FROM public.members m WHERE m.id = members.id)
  AND used_sessions = (SELECT m.used_sessions FROM public.members m WHERE m.id = members.id)
  AND trainer_id IS NOT DISTINCT FROM (SELECT m.trainer_id FROM public.members m WHERE m.id = members.id)
  AND joined_at = (SELECT m.joined_at FROM public.members m WHERE m.id = members.id)
  AND name = (SELECT m.name FROM public.members m WHERE m.id = members.id)
  AND phone = (SELECT m.phone FROM public.members m WHERE m.id = members.id)
);

-- 5. Realtime: remove public:% wildcard
DROP POLICY IF EXISTS "Users can only subscribe to own channels" ON realtime.messages;
CREATE POLICY "Users can only subscribe to own channels" ON realtime.messages
FOR SELECT TO authenticated
USING (realtime.topic() LIKE ('%' || auth.uid()::text));
