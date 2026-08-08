-- Auto-approve all existing pending merchants
UPDATE public.merchants 
SET verification_status = 'approved', 
    verified_at = now() 
WHERE verification_status = 'pending';