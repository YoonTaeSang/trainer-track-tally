-- Core PT studio data tables (was localStorage)

CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  memo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  joined_at date NOT NULL DEFAULT CURRENT_DATE,
  total_sessions int NOT NULL DEFAULT 0,
  used_sessions int NOT NULL DEFAULT 0,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  memo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  date date NOT NULL,
  time text NOT NULL,
  attended boolean,
  signature_requested boolean NOT NULL DEFAULT false,
  signature_url text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  trainer_memo text NOT NULL DEFAULT '',
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  member_memos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_trainer ON public.members(trainer_id);
CREATE INDEX idx_schedules_member ON public.schedules(member_id);
CREATE INDEX idx_schedules_date ON public.schedules(date);
CREATE INDEX idx_workout_logs_schedule ON public.workout_logs(schedule_id);

CREATE TRIGGER trg_workout_logs_updated_at
  BEFORE UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user can read (members need to see trainers etc.)
CREATE POLICY "Auth read trainers" ON public.trainers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read schedules" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read workout_logs" ON public.workout_logs FOR SELECT TO authenticated USING (true);

-- Trainers/admins manage trainers and members fully
CREATE POLICY "Trainer/admin write trainers" ON public.trainers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Trainer/admin write members" ON public.members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'));

-- Members may update their own row (used_sessions on booking)
CREATE POLICY "Members update own member row" ON public.members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Schedules: members can insert (book) and update (signature) any schedule belonging to themselves;
-- trainers/admins can do everything.
CREATE POLICY "Trainer/admin write schedules" ON public.schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Auth insert schedules" ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth update schedules" ON public.schedules FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Workout logs: trainers/admins manage; members may insert/update (own memos)
CREATE POLICY "Trainer/admin write workout_logs" ON public.workout_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Auth insert workout_logs" ON public.workout_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth update workout_logs" ON public.workout_logs FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Realtime
ALTER TABLE public.trainers REPLICA IDENTITY FULL;
ALTER TABLE public.members REPLICA IDENTITY FULL;
ALTER TABLE public.schedules REPLICA IDENTITY FULL;
ALTER TABLE public.workout_logs REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.trainers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_logs;

-- Seed initial trainers + members + schedules so the app isn't empty
DO $$
DECLARE
  t1 uuid;
  t2 uuid;
  m1 uuid;
  m2 uuid;
  m3 uuid;
  m4 uuid;
  d date;
  i int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trainers) THEN
    INSERT INTO public.trainers (name, phone, memo) VALUES
      ('김지훈 트레이너','010-1111-2222','근력 트레이닝 전문') RETURNING id INTO t1;
    INSERT INTO public.trainers (name, phone, memo) VALUES
      ('이수민 트레이너','010-3333-4444','체형 교정 전문') RETURNING id INTO t2;

    INSERT INTO public.members (name,phone,joined_at,total_sessions,used_sessions,trainer_id) VALUES
      ('김민수','010-1234-5678','2025-01-15',30,12,t1) RETURNING id INTO m1;
    INSERT INTO public.members (name,phone,joined_at,total_sessions,used_sessions,trainer_id) VALUES
      ('이지은','010-2345-6789','2025-03-02',20,8,t2) RETURNING id INTO m2;
    INSERT INTO public.members (name,phone,joined_at,total_sessions,used_sessions,trainer_id) VALUES
      ('박서준','010-3456-7890','2025-04-10',50,25,t1) RETURNING id INTO m3;
    INSERT INTO public.members (name,phone,joined_at,total_sessions,used_sessions,trainer_id) VALUES
      ('최유나','010-4567-8901','2025-05-01',10,3,t2) RETURNING id INTO m4;

    FOR i IN -7..7 LOOP
      d := CURRENT_DATE + i;
      INSERT INTO public.schedules (member_id, date, time, attended)
      VALUES (
        (ARRAY[m1,m2,m3,m4])[1 + (abs(hashtext(d::text)) % 4)],
        d,
        (ARRAY['10:00','14:00','18:00','20:00'])[1 + (abs(hashtext(d::text || 'h')) % 4)],
        CASE WHEN i < 0 THEN (random() > 0.2) ELSE NULL END
      );
    END LOOP;
  END IF;
END $$;
