
-- 1) Restrict trainers to only seeing 'member' role rows
DROP POLICY IF EXISTS "Trainers can view all roles" ON public.user_roles;
CREATE POLICY "Trainers can view member roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'trainer'::app_role)
  AND role = 'member'::app_role
);

-- Admins can still see all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Prevent sender spoofing on notifications
DROP POLICY IF EXISTS "Trainers insert notifications" ON public.notifications;
CREATE POLICY "Trainers insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND sender_id = auth.uid()
);
