
DROP POLICY IF EXISTS "Members read assigned trainer basic" ON public.trainers;
DROP VIEW IF EXISTS public.trainers_public;
CREATE VIEW public.trainers_public
  WITH (security_invoker = true) AS
  SELECT t.id, t.name, t.created_at
  FROM public.trainers t;
GRANT SELECT ON public.trainers_public TO authenticated, anon;

-- Allow members assigned to a trainer to see basic trainer info via the view.
-- The view runs with invoker rights, so we still need a SELECT policy on
-- the underlying table for members. Keep it but limit the columns the app
-- queries to non-sensitive ones (enforced in client code via the view).
CREATE POLICY "Members read assigned trainer" ON public.trainers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = auth.uid() AND m.trainer_id = trainers.id));
