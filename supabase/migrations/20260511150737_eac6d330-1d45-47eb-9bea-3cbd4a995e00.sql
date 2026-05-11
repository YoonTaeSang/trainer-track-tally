
-- ============ schedule_requests ============
CREATE TABLE public.schedule_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_user_id uuid NOT NULL,
  trainer_user_id uuid,
  member_name text NOT NULL,
  trainer_name text,
  original_schedule_id text,
  original_date date NOT NULL,
  original_time text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('cancel','change')),
  requested_date date,
  requested_time text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members insert own requests" ON public.schedule_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_user_id);

CREATE POLICY "Members view own requests" ON public.schedule_requests
  FOR SELECT TO authenticated USING (auth.uid() = member_user_id);

CREATE POLICY "Trainers/admins view all requests" ON public.schedule_requests
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "Trainers/admins update requests" ON public.schedule_requests
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "Members cancel own pending request" ON public.schedule_requests
  FOR DELETE TO authenticated USING (auth.uid() = member_user_id AND status='pending');

CREATE TRIGGER schedule_requests_updated_at
  BEFORE UPDATE ON public.schedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_requests;
ALTER TABLE public.schedule_requests REPLICA IDENTITY FULL;

-- ============ messages ============
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX messages_recipient_idx ON public.messages (recipient_id, read);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view messages" ON public.messages
  FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Sender inserts" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipient marks read" ON public.messages
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ============ goals (structured) ============
CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('weight_loss','muscle_gain','endurance','other')),
  title text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  start_value numeric,
  current_value numeric,
  target_value numeric,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_date date,
  trainer_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all on goals" ON public.goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Trainers/admins view goals" ON public.goals
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "Trainers/admins comment goals" ON public.goals
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ goal_progress ============
CREATE TABLE public.goal_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  value numeric NOT NULL,
  memo text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX goal_progress_goal_idx ON public.goal_progress (goal_id, recorded_at DESC);

ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all on goal_progress" ON public.goal_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Trainers/admins view goal_progress" ON public.goal_progress
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );
