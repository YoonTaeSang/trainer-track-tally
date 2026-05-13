-- 대시보드 "잔여 세션 부족 회원" 알림에서 특정 회원을 제외하기 위한 컬럼
-- X 클릭 시 now() 저장 → 알림 목록/카운트에서 제외
-- 세션 충전 시 자동으로 NULL로 리셋 → 다시 떨어지면 알림 재출현

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
