
-- Allow admins to read all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all check_ins
CREATE POLICY "Admins can view all check_ins"
ON public.check_ins FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all medications
CREATE POLICY "Admins can view all medications"
ON public.medications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all alerts
CREATE POLICY "Admins can view all alerts"
ON public.alerts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all health_logs
CREATE POLICY "Admins can view all health_logs"
ON public.health_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all scheduled_reminders
CREATE POLICY "Admins can view all scheduled_reminders"
ON public.scheduled_reminders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all check_in_responses
CREATE POLICY "Admins can view all check_in_responses"
ON public.check_in_responses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
