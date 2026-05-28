
ALTER TABLE public.tender_analyses
  ADD COLUMN IF NOT EXISTS page_intelligence jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS forms_detected jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bid_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scoring_tables jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_blocks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_schedules jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addenda jsonb DEFAULT '[]'::jsonb;
