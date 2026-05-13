-- 스케줄 upsert를 위한 UNIQUE 제약 정비
--
-- 기존:
--   trainer_time_off UNIQUE (trainer_id, date)
--   → 슬롯 단위 예약 불가(여러 row/date) 추가 불가
--   → 같은 날 whole-day가 이미 있으면 INSERT 실패
--
-- 변경:
--   NULLS NOT DISTINCT (Postgres 15+)로 NULL을 같은 값으로 취급하여
--   (trainer_id, date, start_time, end_time) 4-튜플 UNIQUE 유지
--   → whole-day(null, null) 1건, slot-level(09:00, 10:00) 등 N건 공존 가능
--   → upsert는 (trainer_id, date, start_time, end_time) 동일 시 reason 업데이트

-- trainer_time_off
ALTER TABLE public.trainer_time_off
  DROP CONSTRAINT IF EXISTS trainer_time_off_trainer_id_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trainer_time_off'::regclass
      AND conname = 'trainer_time_off_unique'
  ) THEN
    ALTER TABLE public.trainer_time_off
      ADD CONSTRAINT trainer_time_off_unique
      UNIQUE NULLS NOT DISTINCT (trainer_id, date, start_time, end_time);
  END IF;
END$$;

-- trainer_availability: 반복(specific_date=null) + 특정날(specific_date=date)을 같은 키로 구분
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trainer_availability'::regclass
      AND conname = 'trainer_availability_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.trainer_availability
        ADD CONSTRAINT trainer_availability_unique
        UNIQUE NULLS NOT DISTINCT (trainer_id, weekday, start_time, specific_date);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'trainer_availability duplicates exist; remove dups then re-run migration';
    END;
  END IF;
END$$;
