CREATE POLICY "Users update own metrics"
ON public.body_metrics
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);