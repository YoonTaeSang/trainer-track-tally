
-- Fix 1: Force role to 'member' on signup; ignore client-supplied role
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
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', '');
  _phone := NEW.raw_user_meta_data ->> 'phone';
  _birth := NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::date;
  _gender := NEW.raw_user_meta_data ->> 'gender';
  _address := NEW.raw_user_meta_data ->> 'address';

  INSERT INTO public.profiles (id, name, phone, birth_date, gender, address)
  VALUES (NEW.id, _name, _phone, _birth, _gender, _address)
  ON CONFLICT DO NOTHING;

  -- Always assign 'member' role on signup. Elevation to trainer/admin must
  -- be performed by an existing admin via a trusted server-side path.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member'::public.app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.members (user_id, name, phone, status)
  VALUES (NEW.id, _name, COALESCE(_phone, ''), 'pending')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Fix 2: Remove member access to full trainers row (which exposes phone/memo).
-- Members should read trainer name only via the trainers_public view.
DROP POLICY IF EXISTS "Members read assigned trainer" ON public.trainers;

-- Ensure the public view exists and is SECURITY INVOKER
CREATE OR REPLACE VIEW public.trainers_public
WITH (security_invoker = true) AS
SELECT id, name, created_at FROM public.trainers;

GRANT SELECT ON public.trainers_public TO authenticated, anon;

-- Allow members to read the public projection of their assigned trainer
-- (and any trainer, since only non-sensitive fields are exposed).
DROP POLICY IF EXISTS "Authenticated read trainers public projection" ON public.trainers;
CREATE POLICY "Authenticated read trainers public projection"
ON public.trainers
FOR SELECT
TO authenticated
USING (
  -- Restrict via view by limiting which columns are exposed:
  -- the policy itself cannot restrict columns, so we keep full-row access
  -- gated to admin/trainer only. Members go through trainers_public view.
  has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);
