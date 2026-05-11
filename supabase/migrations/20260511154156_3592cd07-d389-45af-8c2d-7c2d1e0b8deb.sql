
-- 1. Update handle_new_user to create members row for new member signups
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
  VALUES (NEW.id, _name, _phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  IF _role = 'member'::public.app_role THEN
    INSERT INTO public.members (user_id, name, phone)
    VALUES (NEW.id, _name, COALESCE(_phone, ''))
    ON CONFLICT DO NOTHING;
  ELSIF _role = 'trainer'::public.app_role THEN
    INSERT INTO public.trainers (user_id, name, phone)
    VALUES (NEW.id, _name, COALESCE(_phone, ''))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tighten schedules RLS
DROP POLICY IF EXISTS "Auth insert schedules" ON public.schedules;
DROP POLICY IF EXISTS "Auth update schedules" ON public.schedules;

CREATE POLICY "Members update own schedules"
  ON public.schedules FOR UPDATE
  TO authenticated
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

-- 3. Tighten workout_logs RLS
DROP POLICY IF EXISTS "Auth insert workout_logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Auth update workout_logs" ON public.workout_logs;

CREATE POLICY "Members update own workout_logs"
  ON public.workout_logs FOR UPDATE
  TO authenticated
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

-- 4. Revoke EXECUTE on handle_new_user from regular roles (only auth trigger needs it)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 5. Storage: drop broad listing policy on signatures bucket.
-- Files remain accessible via direct public URL since the bucket is public,
-- but clients can no longer enumerate the bucket contents.
DROP POLICY IF EXISTS "Signatures are publicly readable" ON storage.objects;

-- 6. Backfill: link existing members rows to auth users by phone, where unambiguous
UPDATE public.members m
SET user_id = p.id
FROM auth.users p
WHERE m.user_id IS NULL
  AND p.raw_user_meta_data ->> 'phone' IS NOT NULL
  AND p.raw_user_meta_data ->> 'phone' = m.phone;
