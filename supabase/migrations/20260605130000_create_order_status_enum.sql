-- The order_status enum existed only as a manual object in the previous project's
-- database (it was never captured in a migration file). Later migrations reference
-- it via ALTER TYPE, so create it here to keep the schema reproducible.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'order_status' AND n.nspname = 'public') THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending',
      'in_progress',
      'delivered',
      'completed',
      'disputed',
      'refunded',
      'cancelled',
      'draft',
      'escrow_locked',
      'shipped',
      'awaiting_shipment'
    );
  END IF;
END
$$;
