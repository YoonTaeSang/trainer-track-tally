DROP VIEW IF EXISTS public.trainers_public;
CREATE VIEW public.trainers_public
WITH (security_invoker = true)
AS
SELECT id, user_id, name, created_at
FROM public.trainers;

GRANT SELECT ON public.trainers_public TO authenticated, anon;