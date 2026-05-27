
ALTER TABLE public.tender_analyses
  ADD COLUMN IF NOT EXISTS tender_title text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS tender_category text,
  ADD COLUMN IF NOT EXISTS contract_duration text,
  ADD COLUMN IF NOT EXISTS procurement_type text,
  ADD COLUMN IF NOT EXISTS jv_requirements text,
  ADD COLUMN IF NOT EXISTS subcontracting_requirements text,
  ADD COLUMN IF NOT EXISTS professional_registrations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submission_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS returnables jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluation_criteria jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS detected_tables jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_intelligence jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pages_flagged jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS readiness_score numeric;
