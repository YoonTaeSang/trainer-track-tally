
-- Body metrics history
CREATE TABLE public.body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  height numeric(5,2),
  weight numeric(5,2),
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own metrics" ON public.body_metrics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own metrics" ON public.body_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own metrics" ON public.body_metrics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Trainers view all metrics" ON public.body_metrics FOR SELECT TO authenticated USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Member goals (one per user)
CREATE TABLE public.member_goals (
  user_id uuid PRIMARY KEY,
  goal_text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own goal" ON public.member_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own goal" ON public.member_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goal" ON public.member_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Trainers view all goals" ON public.member_goals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_member_goals_updated BEFORE UPDATE ON public.member_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Trainers insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
