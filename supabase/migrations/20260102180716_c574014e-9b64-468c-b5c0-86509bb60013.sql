-- Schedule the deletion notification to run daily at 2 AM UTC (1 hour before cleanup)
SELECT cron.schedule(
  'notify-order-deletion-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://clktemmpxyxrggmtxwkz.supabase.co/functions/v1/notify-order-deletion',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa3RlbW1weHl4cmdnbXR4d2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxOTM4NDksImV4cCI6MjA4Mjc2OTg0OX0.hAFejzmQnSYdrAY0YrsD9VUfKrDFMVyjgMutoeZgh2A"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);