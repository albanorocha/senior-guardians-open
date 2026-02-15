
-- Create alerts table
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  check_in_id uuid REFERENCES public.check_ins(id),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  reason text NOT NULL,
  tag text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts" ON public.alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge own alerts" ON public.alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- Create health_logs table
CREATE TABLE public.health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  check_in_id uuid REFERENCES public.check_ins(id),
  category text NOT NULL,
  details text NOT NULL,
  tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health_logs" ON public.health_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health_logs" ON public.health_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create scheduled_reminders table
CREATE TABLE public.scheduled_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  check_in_id uuid REFERENCES public.check_ins(id),
  reason text NOT NULL,
  scheduled_time text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" ON public.scheduled_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders" ON public.scheduled_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" ON public.scheduled_reminders
  FOR UPDATE USING (auth.uid() = user_id);
