CREATE OR REPLACE FUNCTION public.sync_member_identity_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET name = NEW.name, phone = NEW.phone
    WHERE id = NEW.user_id
      AND (name IS DISTINCT FROM NEW.name OR phone IS DISTINCT FROM NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_member_identity_to_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_member_identity_to_profile
AFTER UPDATE OF name, phone ON public.members
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.phone IS DISTINCT FROM NEW.phone)
EXECUTE FUNCTION public.sync_member_identity_to_profile();