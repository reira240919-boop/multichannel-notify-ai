-- 案件5 マルチチャネル通知 + AI自動分類
-- 練習用に、サロン管理デモの Supabase を借りている。この案件の表は case5 スキーマだけに置く。
-- public（デモの表）には触らない。練習が終わったら drop schema case5 cascade; で消せる。

create schema if not exists case5;

-- 受信した問い合わせのキュー
create table if not exists case5.inquiry_queue (
  id uuid primary key default gen_random_uuid(),
  channel text not null,                 -- gmail / line
  external_id text unique,               -- 各 API の MessageId（重複防止）
  raw_content text not null,
  category text,                         -- 賃貸 / 売買 / 内見 / クレーム
  is_urgent boolean default false,
  status text default 'pending',         -- pending / classified / notified / failed
  classified_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_inquiry_status on case5.inquiry_queue(status, created_at);

-- Gmail を「どこまで見たか」の印（1行だけ）
create table if not exists case5.gmail_state (
  id int primary key default 1 check (id = 1),
  history_id text not null,
  updated_at timestamptz default now()
);

-- フェーズ 3：処理の回数と、取り出した時刻
-- status に processing（処理中）を使う。取り出したまま5分たったものは、止まったとみなしてやり直す
alter table case5.inquiry_queue add column if not exists attempts int not null default 0;
alter table case5.inquiry_queue add column if not exists picked_at timestamptz;
alter table case5.inquiry_queue add column if not exists ai_reason text;

-- フェーズ 4：部長の LINE に送った時刻（5分以内だったかを確かめる）
alter table case5.inquiry_queue add column if not exists line_notified_at timestamptz;
