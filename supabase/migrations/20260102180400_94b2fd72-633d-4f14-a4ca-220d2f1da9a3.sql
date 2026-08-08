-- Schedule the cleanup function to run daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-cancelled-orders-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://clktemmpxyxrggmtxwkz.supabase.co/functions/v1/cleanup-cancelled-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa3RlbW1weHl4cmdnbXR4d2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxOTM4NDksImV4cCI6MjA4Mjc2OTg0OX0.hAFejzmQnSYdrAY0YrsD9VUfKrDFMVyjgMutoeZgh2A"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);