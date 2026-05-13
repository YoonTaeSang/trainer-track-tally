-- 회원이 일정 변경 요청 시 트레이너에게 함께 보낼 메시지
ALTER TABLE public.schedule_requests
  ADD COLUMN IF NOT EXISTS message TEXT;
