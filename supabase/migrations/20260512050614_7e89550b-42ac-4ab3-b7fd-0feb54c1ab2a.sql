-- Trainer weekly availability (recurring weekday time slots)
CREATE TABLE public.trainer_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trainer_availability_trainer_idx ON public.trainer_availability(trainer_id);

ALTER TABLE public.trainer_availability ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (members need this to pick change-request slots)
CREATE POLICY "Authenticated read availability"
  ON public.trainer_availability FOR SELECT
  TO authenticated
  USING (true);

-- Admins fully manage
CREATE POLICY "Admins manage availability"
  ON public.trainer_availability FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trainers manage their own rows (trainer_id matches a trainers row whose user_id = auth.uid())
CREATE POLICY "Trainers manage own availability"
  ON public.trainer_availability FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'trainer'::app_role) AND EXISTS (
      SELECT 1 FROM public.trainers t WHERE t.id = trainer_availability.trainer_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'trainer'::app_role) AND EXISTS (
      SELECT 1 FROM public.trainers t WHERE t.id = trainer_availability.trainer_id AND t.user_id = auth.uid()
    )
  );

-- Trainer time off (specific date)
CREATE TABLE public.trainer_time_off (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, date)
);

CREATE INDEX trainer_time_off_trainer_idx ON public.trainer_time_off(trainer_id);

ALTER TABLE public.trainer_time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read time off"
  ON public.trainer_time_off FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage time off"
  ON public.trainer_time_off FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trainers manage own time off"
  ON public.trainer_time_off FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'trainer'::app_role) AND EXISTS (
      SELECT 1 FROM public.trainers t WHERE t.id = trainer_time_off.trainer_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'trainer'::app_role) AND EXISTS (
      SELECT 1 FROM public.trainers t WHERE t.id = trainer_time_off.trainer_id AND t.user_id = auth.uid()
    )
  );