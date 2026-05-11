-- 1. members.status 컬럼 추가 (가입승인 흐름용)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 기존 회원은 모두 active 유지, 신규 가입 회원만 pending이 되도록 트리거 갱신
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _name text;
  _phone text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', '');
  _phone := NEW.raw_user_meta_data ->> 'phone';
  _role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'member'::public.app_role);

  INSERT INTO public.profiles (id, name, phone)
  VALUES (NEW.id, _name, _phone)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  IF _role = 'member'::public.app_role THEN
    INSERT INTO public.members (user_id, name, phone, status)
    VALUES (NEW.id, _name, COALESCE(_phone, ''), 'pending')
    ON CONFLICT DO NOTHING;
  ELSIF _role = 'trainer'::public.app_role THEN
    INSERT INTO public.trainers (user_id, name, phone)
    VALUES (NEW.id, _name, COALESCE(_phone, ''))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. notifications에 sender_id, category 추가 (공지 분리용)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sender_id uuid,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON public.notifications (user_id, category, read);
