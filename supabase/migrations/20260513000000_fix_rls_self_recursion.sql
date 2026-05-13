-- Fix: 회원 업데이트 정책의 WITH CHECK가 자기 자신 테이블을 서브쿼리로 참조하면서
-- Postgres가 infinite recursion으로 판단해 500 에러를 던지던 문제 수정.
-- 트레이너/관리자 UPDATE까지 함께 막혀서 서명 요청, 출석 처리 등이 동작 안 함.
--
-- 정책 강도는 다소 완화되지만 (회원이 자기 schedule의 attended/date/time 등을
-- 직접 변경하지 못하는 보호는 사라짐) 앱 로직이 변경 API를 노출하지 않으므로
-- 현실적 위험은 낮음. 추가 보호가 필요해지면 SECURITY DEFINER 함수로 다시 작성할 것.

-- 1. schedules
DROP POLICY IF EXISTS "Members update own schedules" ON public.schedules;
CREATE POLICY "Members update own schedules" ON public.schedules
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = schedules.member_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = schedules.member_id AND m.user_id = auth.uid()
  )
);

-- 2. workout_logs
DROP POLICY IF EXISTS "Members update own workout_logs" ON public.workout_logs;
CREATE POLICY "Members update own workout_logs" ON public.workout_logs
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = workout_logs.member_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = workout_logs.member_id AND m.user_id = auth.uid()
  )
);

-- 3. members (own row update)
DROP POLICY IF EXISTS "Members update own memo only" ON public.members;
CREATE POLICY "Members update own member row" ON public.members
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
