-- 트레이너 스케줄을 시간 단위(슬롯)로 관리하기 위한 컬럼 확장
--
-- trainer_availability.specific_date:
--   NULL → 매주 반복 (기존 동작, weekday 기준)
--   값이 있으면 그 날짜 전용 가용 시간대
--
-- trainer_time_off.start_time / end_time:
--   둘 다 NULL → 그날 전체 예약 불가 (기존 동작)
--   둘 다 값이 있으면 그 시간대만 예약 불가 (슬롯 단위 차단)

ALTER TABLE public.trainer_availability
  ADD COLUMN IF NOT EXISTS specific_date DATE;

ALTER TABLE public.trainer_time_off
  ADD COLUMN IF NOT EXISTS start_time TEXT;

ALTER TABLE public.trainer_time_off
  ADD COLUMN IF NOT EXISTS end_time TEXT;
