-- Schedule the deletion notification to run daily at 2 AM UTC (1 hour before cleanup)
SELECT cron.schedule(
  'notify-order-deletion-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jcxhagmfbezpgrxdxfvs.supabase.co/functions/v1/notify-order-deletion',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_FYAA7exANWNkEdAqkTSX7Q_y7wHeWOe"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);