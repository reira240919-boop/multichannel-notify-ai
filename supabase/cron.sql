-- 1分ごとに、本番の呼び出し口（/api/cron/classify）を呼ぶ設定。
-- 合言葉（CRON_SECRET）は、Supabase の金庫（Vault）に case5_cron_secret という名前で先にしまっておく：
--   select vault.create_secret('<CRON_SECRET の値>', 'case5_cron_secret');
-- 止めるとき：select cron.unschedule('case5-classify');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'case5-classify',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://multichannel-notify-ai.vercel.app/api/cron/classify',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'case5_cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);
