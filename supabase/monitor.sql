-- 監視用：ここ24時間の問い合わせが、ちゃんと流れているかを見る。
-- Supabase の SQL Editor に貼って Run するだけ（読むだけで、何も変えない）。
--
-- 見かた：
--   「止まっている」「失敗」「クレーム5分超え」がすべて 0 なら問題なし。
--   1 以上なら、下の「2. 要確認の一覧」を流して中身を確かめる。

-- 1. ここ24時間のまとめ
select
  count(*)                                                       as 合計,
  count(*) filter (where status = 'notified')                    as 通知済み,
  count(*) filter (where status in ('pending', 'processing', 'classified')
                     and created_at < now() - interval '5 minutes') as 止まっている,
  count(*) filter (where status = 'failed')                      as 失敗,
  count(*) filter (where category = 'クレーム'
                     and (line_notified_at is null
                          or line_notified_at - created_at > interval '5 minutes')
                     and created_at < now() - interval '5 minutes') as クレーム5分超え
from case5.inquiry_queue
where created_at > now() - interval '24 hours';

-- 2. 要確認の一覧（上で 1 以上が出たときに流す）
select
  to_char(created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') as 受付,
  channel   as 経路,
  status    as 状態,
  attempts  as 試した回数,
  category  as 分類,
  left(raw_content, 40) as 本文の先頭
from case5.inquiry_queue
where created_at > now() - interval '24 hours'
  and (
    status = 'failed'
    or (status <> 'notified' and created_at < now() - interval '5 minutes')
    or (category = 'クレーム'
        and (line_notified_at is null or line_notified_at - created_at > interval '5 minutes')
        and created_at < now() - interval '5 minutes')
  )
order by created_at;
