-- 이전 마이그레이션(20260513040000/050000)이 부분 실행됐거나 OLD 제약이 살아남은
-- 경우를 정리하는 모든-걸-한-방에 마이그레이션.
-- 실행 전후로 idempotent하므로 재실행 안전.

-- 1) 기존 OLD UNIQUE 제약 제거 (있으면)
ALTER TABLE public.trainer_time_off
  DROP CONSTRAINT IF EXISTS trainer_time_off_trainer_id_date_key;

-- 2) 중복 row 제거: 가장 오래된 row 1개만 남김
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

-- 3) 새 NULLS NOT DISTINCT UNIQUE 제약 추가 (있으면 스킵)
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
