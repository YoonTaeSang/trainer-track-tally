-- 기존 trainer_availability / trainer_time_off 중복 행 제거 후
-- NULLS NOT DISTINCT UNIQUE 제약 추가 (upsert 동작에 필요)
--
-- 중복이 있던 이유: 이전 마이그레이션 적용 전에 같은 (trainer_id, weekday,
-- start_time, specific_date) 조합으로 여러 insert가 실행된 적이 있음.
-- 가장 오래된 row(created_at 기준)를 남기고 나머지 삭제.

-- 1. trainer_availability 중복 제거
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY trainer_id, weekday, start_time,
                        COALESCE(specific_date::text, '__NULL__')
           ORDER BY created_at, id
         ) AS rn
  FROM public.trainer_availability
)
DELETE FROM public.trainer_availability
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. trainer_time_off 중복 제거
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY trainer_id, date,
                        COALESCE(start_time, '__NULL__'),
                        COALESCE(end_time, '__NULL__')
           ORDER BY created_at, id
         ) AS rn
  FROM public.trainer_time_off
)
DELETE FROM public.trainer_time_off
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. 제약조건이 아직 없을 때만 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trainer_availability'::regclass
      AND conname = 'trainer_availability_unique'
  ) THEN
    ALTER TABLE public.trainer_availability
      ADD CONSTRAINT trainer_availability_unique
      UNIQUE NULLS NOT DISTINCT (trainer_id, weekday, start_time, specific_date);
  END IF;
END$$;

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
