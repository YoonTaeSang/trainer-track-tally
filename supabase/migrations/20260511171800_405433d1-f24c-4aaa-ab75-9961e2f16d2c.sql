ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS address text;

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
  _birth date;
  _gender text;
  _address text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', '');
  _phone := NEW.raw_user_meta_data ->> 'phone';
  _birth := NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::date;
  _gender := NEW.raw_user_meta_data ->> 'gender';
  _address := NEW.raw_user_meta_data ->> 'address';
  _role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'member'::public.app_role);

  INSERT INTO public.profiles (id, name, phone, birth_date, gender, address)
  VALUES (NEW.id, _name, _phone, _birth, _gender, _address)
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