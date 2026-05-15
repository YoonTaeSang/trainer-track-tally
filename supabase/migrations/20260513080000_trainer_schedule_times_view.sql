-- 회원이 본인 담당 트레이너의 "어떤 시간이 이미 예약됐는지"만 알 수 있도록
-- 최소한의 정보만 노출하는 뷰. 회원 정보는 포함하지 않음.
--
-- schedules 테이블 RLS는 회원에게 본인 일정만 보여주므로, 다른 회원이
-- 같은 트레이너에게 잡은 일정을 알 수 없어 변경 요청 시 충돌 안내가
-- 동작하지 않던 문제 해결.

CREATE OR REPLACE VIEW public.trainer_schedule_times AS
SELECT
  m.trainer_id,
  s.id   AS schedule_id,
  s.date,
  s.time
FROM public.schedules s
JOIN public.members m ON m.id = s.member_id;

-- 뷰가 호출자의 권한이 아닌 뷰 소유자의 권한으로 동작하게 함
-- → 회원이 뷰를 SELECT 해도 underlying RLS 우회 가능
ALTER VIEW public.trainer_schedule_times SET (security_invoker = off);

GRANT SELECT ON public.trainer_schedule_times TO authenticated;
