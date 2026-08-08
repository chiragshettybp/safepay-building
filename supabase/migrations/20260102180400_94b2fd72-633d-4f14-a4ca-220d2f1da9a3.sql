-- Schedule the cleanup function to run daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-cancelled-orders-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jcxhagmfbezpgrxdxfvs.supabase.co/functions/v1/cleanup-cancelled-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_FYAA7exANWNkEdAqkTSX7Q_y7wHeWOe"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);