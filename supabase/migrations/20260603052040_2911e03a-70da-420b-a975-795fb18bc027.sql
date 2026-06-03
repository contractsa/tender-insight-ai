-- Add missing columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

-- Company profiles
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  legal_name text,
  registration_number text,
  vat_number text,
  tax_compliance_status text,
  business_structure text,
  cidb_grade text,
  cidb_designation text,
  bbbee_level text,
  bbbee_certificate_type text,
  professional_registrations jsonb NOT NULL DEFAULT '[]'::jsonb,
  directors jsonb NOT NULL DEFAULT '[]'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profiles TO authenticated;
GRANT ALL ON public.company_profiles TO service_role;

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own company profile" ON public.company_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own company profile" ON public.company_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own company profile" ON public.company_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own company profile" ON public.company_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Monitored tenders
CREATE TABLE IF NOT EXISTS public.monitored_tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid,
  tender_reference text,
  tender_title text,
  closing_date date,
  closing_time text,
  source_url text,
  status text NOT NULL DEFAULT 'active',
  last_checked timestamptz,
  changes_detected jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitored_tenders TO authenticated;
GRANT ALL ON public.monitored_tenders TO service_role;

ALTER TABLE public.monitored_tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own monitored tenders" ON public.monitored_tenders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own monitored tenders" ON public.monitored_tenders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own monitored tenders" ON public.monitored_tenders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own monitored tenders" ON public.monitored_tenders
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_monitored_tenders_updated_at
  BEFORE UPDATE ON public.monitored_tenders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();