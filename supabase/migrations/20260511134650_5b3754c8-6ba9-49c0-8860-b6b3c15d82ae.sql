
-- Exercises library table
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body_part text NOT NULL,
  difficulty text NOT NULL,
  description text NOT NULL DEFAULT '',
  youtube_url text,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can view exercises"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (true);

-- Only admin or trainer can manage
CREATE POLICY "Admin or trainer can insert exercises"
  ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Admin or trainer can update exercises"
  ON public.exercises FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Admin or trainer can delete exercises"
  ON public.exercises FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER exercises_set_updated_at
  BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Favorites table
CREATE TABLE public.exercise_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.exercise_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorites"
  ON public.exercise_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own favorites"
  ON public.exercise_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Seed sample data
INSERT INTO public.exercises (name, body_part, difficulty, description, youtube_url) VALUES
  ('벤치 프레스', '가슴', '중급', '바벨을 가슴 위로 천천히 내렸다가 밀어 올립니다. 어깨가 들리지 않도록 견갑골을 모은 자세를 유지하세요.', 'https://www.youtube.com/watch?v=rT7DgCr-3pg'),
  ('푸쉬업', '가슴', '초급', '손은 어깨 너비, 몸은 일자로 유지하며 천천히 내렸다 올라옵니다. 허리가 꺾이지 않게 코어에 힘을 줍니다.', 'https://www.youtube.com/watch?v=IODxDxX7oi4'),
  ('데드리프트', '등', '고급', '엉덩이를 뒤로 빼고 척추 중립을 유지한 채 바벨을 들어올립니다. 허리가 둥글게 말리지 않도록 주의하세요.', 'https://www.youtube.com/watch?v=op9kVnSso6Q'),
  ('랫 풀다운', '등', '초급', '바를 가슴 위쪽으로 당기며 광배근에 자극을 줍니다. 반동을 사용하지 않습니다.', 'https://www.youtube.com/watch?v=CAwf7n6Luuc'),
  ('숄더 프레스', '어깨', '중급', '덤벨을 머리 위로 곧게 밀어 올립니다. 허리가 꺾이지 않도록 코어를 잡아주세요.', 'https://www.youtube.com/watch?v=qEwKCR5JCog'),
  ('스쿼트', '하체', '중급', '발은 어깨 너비, 무릎이 발끝을 넘지 않도록 엉덩이를 뒤로 빼며 앉습니다.', 'https://www.youtube.com/watch?v=ultWZbUMPL8'),
  ('런지', '하체', '초급', '한 발을 앞으로 내딛어 무릎을 90도로 굽힙니다. 무릎이 안쪽으로 모이지 않게 주의하세요.', 'https://www.youtube.com/watch?v=QOVaHwm-Q6U'),
  ('플랭크', '복근', '초급', '팔꿈치를 어깨 아래에 두고 몸을 일자로 유지합니다. 엉덩이가 처지지 않게 합니다.', 'https://www.youtube.com/watch?v=ASdvN_XEl_c'),
  ('바이셉 컬', '팔', '초급', '팔꿈치를 옆구리에 고정하고 덤벨을 천천히 올립니다. 반동 없이 수축에 집중하세요.', 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo'),
  ('트라이셉 익스텐션', '팔', '중급', '팔꿈치를 머리 옆에 고정한 채 덤벨을 머리 뒤로 내렸다 올립니다.', 'https://www.youtube.com/watch?v=_gsUck-7M74');
