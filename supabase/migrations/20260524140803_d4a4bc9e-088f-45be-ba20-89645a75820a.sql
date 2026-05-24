
-- Prevent duplicate analyses per document
CREATE UNIQUE INDEX IF NOT EXISTS tender_analyses_document_id_unique
  ON public.tender_analyses (document_id);

-- Atomic credit reservation: returns true if deducted, false if insufficient
CREATE OR REPLACE FUNCTION public.reserve_credits(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current integer;
BEGIN
  SELECT credits_remaining INTO _current
  FROM public.profiles
  WHERE user_id = _user_id
  FOR UPDATE;

  IF _current IS NULL OR _current < _amount THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET credits_remaining = credits_remaining - _amount,
      updated_at = now()
  WHERE user_id = _user_id;

  RETURN true;
END;
$$;

-- Refund credits (used on AI failure)
CREATE OR REPLACE FUNCTION public.refund_credits(_user_id uuid, _amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_remaining = LEAST(credits_total, credits_remaining + _amount),
      updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_credits(uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.refund_credits(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer) TO service_role;
