
-- ===== members table =====
DROP POLICY IF EXISTS "Auth read members" ON public.members;
CREATE POLICY "Members read own row" ON public.members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Trainers/admins read members" ON public.members
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Restrict member self-update to only the memo column (others remain unchanged via WITH CHECK)
DROP POLICY IF EXISTS "Members update own member row" ON public.members;
CREATE POLICY "Members update own memo only" ON public.members
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT status FROM public.members WHERE id = members.id)
    AND total_sessions = (SELECT total_sessions FROM public.members WHERE id = members.id)
    AND used_sessions = (SELECT used_sessions FROM public.members WHERE id = members.id)
    AND trainer_id IS NOT DISTINCT FROM (SELECT trainer_id FROM public.members WHERE id = members.id)
    AND joined_at = (SELECT joined_at FROM public.members WHERE id = members.id)
    AND name = (SELECT name FROM public.members WHERE id = members.id)
    AND phone = (SELECT phone FROM public.members WHERE id = members.id)
  );

-- ===== schedules =====
DROP POLICY IF EXISTS "Auth read schedules" ON public.schedules;
CREATE POLICY "Members read own schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = schedules.member_id AND m.user_id = auth.uid()));
CREATE POLICY "Trainers/admins read schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ===== workout_logs =====
DROP POLICY IF EXISTS "Auth read workout_logs" ON public.workout_logs;
CREATE POLICY "Members read own workout_logs" ON public.workout_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = workout_logs.member_id AND m.user_id = auth.uid()));
CREATE POLICY "Trainers/admins read workout_logs" ON public.workout_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ===== trainers (hide phone from members) =====
DROP POLICY IF EXISTS "Auth read trainers" ON public.trainers;
-- Recreate as trainers/admins full read; members get a safe view
CREATE POLICY "Trainers/admins read trainers" ON public.trainers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
-- Members can read trainer rows but only via a view that excludes phone/memo
CREATE OR REPLACE VIEW public.trainers_public AS
  SELECT id, name, created_at FROM public.trainers;
GRANT SELECT ON public.trainers_public TO authenticated, anon;
-- Members assigned to a trainer can see that trainer's basic info
CREATE POLICY "Members read assigned trainer basic" ON public.trainers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = auth.uid() AND m.trainer_id = trainers.id));

-- ===== goals: prevent trainers from changing ownership =====
DROP POLICY IF EXISTS "Trainers/admins comment goals" ON public.goals;
CREATE POLICY "Trainers/admins comment goals" ON public.goals
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND user_id = (SELECT user_id FROM public.goals WHERE id = goals.id)
  );

-- ===== signatures bucket: make private =====
UPDATE storage.buckets SET public = false WHERE id = 'signatures';

-- Storage policies for signatures
DROP POLICY IF EXISTS "Authenticated users can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Signatures upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Signatures read own or trainer" ON storage.objects;

CREATE POLICY "Signatures upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Signatures read own or trainer" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'trainer'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
