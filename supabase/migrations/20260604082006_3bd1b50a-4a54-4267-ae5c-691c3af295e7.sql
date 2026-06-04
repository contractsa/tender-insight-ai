CREATE TABLE IF NOT EXISTS public.submission_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL,
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_status text NOT NULL DEFAULT 'in_progress',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_packs TO authenticated;
GRANT ALL ON public.submission_packs TO service_role;
ALTER TABLE public.submission_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own submission packs" ON public.submission_packs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own submission packs" ON public.submission_packs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own submission packs" ON public.submission_packs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own submission packs" ON public.submission_packs FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_submission_packs_updated_at BEFORE UPDATE ON public.submission_packs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eligibility_checks TO authenticated;
GRANT ALL ON public.eligibility_checks TO service_role;
ALTER TABLE public.eligibility_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own eligibility" ON public.eligibility_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own eligibility" ON public.eligibility_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own eligibility" ON public.eligibility_checks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own eligibility" ON public.eligibility_checks FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_eligibility_checks_updated_at BEFORE UPDATE ON public.eligibility_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();