
REVOKE EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer) TO service_role;
