DROP VIEW IF EXISTS public.trainers_public;

CREATE OR REPLACE VIEW public.trainers_public
WITH (security_invoker = true)
AS
SELECT id, user_id, name, created_at
FROM public.trainers;

GRANT SELECT ON public.trainers_public TO authenticated, anon;

-- Allow authenticated users to read trainers rows (column-level grants below
-- restrict which columns are actually accessible).
DROP POLICY IF EXISTS "Authenticated read trainers public projection" ON public.trainers;
CREATE POLICY "Authenticated read trainers public projection"
ON public.trainers
FOR SELECT
TO authenticated
USING (true);

-- Restrict column access: only safe columns are readable by default.
REVOKE SELECT ON public.trainers FROM authenticated, anon;
GRANT SELECT (id, user_id, name, created_at) ON public.trainers TO authenticated, anon;
-- Trainers/admins keep full access via their existing role-based policies and
-- the postgres role grants used by service_role.
GRANT SELECT (phone, memo) ON public.trainers TO service_role;