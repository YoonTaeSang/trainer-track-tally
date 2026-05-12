
-- 1) Restrict trainers table access to admins only
DROP POLICY IF EXISTS "Authenticated read trainers public projection" ON public.trainers;
DROP POLICY IF EXISTS "Trainers/admins read trainers" ON public.trainers;
DROP POLICY IF EXISTS "Trainer/admin write trainers" ON public.trainers;
DROP POLICY IF EXISTS "Admins manage trainers" ON public.trainers;

CREATE POLICY "Admins manage trainers"
ON public.trainers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Re-grant column-level SELECT so admins reading SELECT * succeed.
GRANT SELECT ON public.trainers TO authenticated;

-- 2) Make trainers_public readable by all authenticated (and anon) users
-- Switch to security_definer so the view bypasses the table-level RLS
-- and exposes only non-sensitive columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'trainers_public' AND relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.trainers_public SET (security_invoker = off)';
    EXECUTE 'GRANT SELECT ON public.trainers_public TO authenticated, anon';
  END IF;
END$$;

-- 3) Add email column to members + profiles so admin approval list shows it
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 4) Update signup trigger to capture email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
  _phone text;
  _birth date;
  _gender text;
  _address text;
  _email text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', '');
  _phone := NEW.raw_user_meta_data ->> 'phone';
  _birth := NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::date;
  _gender := NEW.raw_user_meta_data ->> 'gender';
  _address := NEW.raw_user_meta_data ->> 'address';
  _email := NEW.email;

  INSERT INTO public.profiles (id, name, phone, birth_date, gender, address, email)
  VALUES (NEW.id, _name, _phone, _birth, _gender, _address, _email)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member'::public.app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.members (user_id, name, phone, email, status)
  VALUES (NEW.id, _name, COALESCE(_phone, ''), _email, 'pending')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill emails for any existing members where missing
UPDATE public.members m
SET email = u.email
FROM auth.users u
WHERE m.user_id = u.id AND (m.email IS NULL OR m.email = '');

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
