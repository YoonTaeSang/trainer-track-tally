-- 문제:
-- trainer_availability / trainer_time_off의 RLS WITH CHECK는
--   EXISTS (SELECT 1 FROM trainers t WHERE t.id = trainer_id AND t.user_id = auth.uid())
-- 를 요구. 하지만 trainer 권한 사용자가 trainers 테이블을 수정/생성할 RLS가
-- "Admins manage trainers" 만 있어서, 본인 trainers 행의 user_id를 자기 자신으로
-- 연결할 수 없음 → 결국 availability/time_off insert가 막힘.
--
-- 해결:
-- 트레이너 권한 사용자가 자기 trainers 행을 self-link / self-manage 할 수 있는
-- 두 개의 정책 추가.

-- 1) 트레이너가 미연결 trainers 행을 자기 user_id로 연결할 수 있게 함
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trainers'
      AND policyname = 'Trainers self-link own row'
  ) THEN
    CREATE POLICY "Trainers self-link own row"
      ON public.trainers
      FOR UPDATE
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'trainer'::public.app_role)
        AND user_id IS NULL
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'trainer'::public.app_role)
        AND user_id = auth.uid()
      );
  END IF;
END$$;

-- 2) 트레이너가 본인 행(이미 user_id로 연결된)을 관리할 수 있게 함
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trainers'
      AND policyname = 'Trainers manage own row'
  ) THEN
    CREATE POLICY "Trainers manage own row"
      ON public.trainers
      FOR ALL
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'trainer'::public.app_role)
        AND user_id = auth.uid()
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'trainer'::public.app_role)
        AND user_id = auth.uid()
      );
  END IF;
END$$;
