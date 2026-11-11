# API キーの取り替え手順（開発者向け）

鍵がもれたかもしれないとき、担当が替わるとき、定期の見直しのときに使います。
鍵の値は、チャットや Git に貼らないでください。`.env.local` と Vercel の環境変数だけに置きます。

## 基本の流れ

1. 新しい鍵を発行する
2. `.env.local` を書きかえ、手元で動くか試す
3. Vercel の環境変数を書きかえる
4. 本番を作り直す（環境変数は、作り直すまで反映されません）
5. 下の「取り替えたあとの確認」をする
6. 古い鍵を無効にする（先に無効にできる鍵は、下の表に書いています）

Vercel の書きかえ（例：ANTHROPIC_API_KEY）

```bash
vercel env rm ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_API_KEY production   # 聞かれたら新しい値を貼る
vercel --prod                                 # 作り直し
```

## 鍵ごとの発行場所

| 環境変数 | 発行する場所 | 古い鍵 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Console → Settings → API keys で新しく作る | 本番の確認が済んでから、古い鍵を削除 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → チャネル → Messaging API設定 → チャネルアクセストークン（長期）の「再発行」 | 再発行した時点で古い鍵は使えなくなる。すぐ Vercel を書きかえる |
| `LINE_CHANNEL_SECRET` | LINE Developers → チャネル → チャネル基本設定 → チャネルシークレットの「発行」 | 発行した時点で切り替わる。書きかえまでの間、LINE の受け取りは 401 になる |
| `SLACK_BOT_TOKEN` | api.slack.com/apps → アプリ → OAuth & Permissions で古いトークンを取り消し、ワークスペースに入れ直す | 取り消した時点で使えなくなる |
| `GMAIL_CLIENT_SECRET` | Google Cloud Console → APIとサービス → 認証情報 → OAuth クライアント → シークレットを追加 | 新しい方で動いたら、古いシークレットを無効にして削除 |
| `GMAIL_REFRESH_TOKEN` | `python3 scripts/gmail-auth.py <credentials.json> <窓口のメール>` で許可を取り直す | 窓口の Google アカウント → セキュリティ → サードパーティ接続 から古い許可を外せる |
| `CRON_SECRET` | `openssl rand -hex 32` で作る | 下の「CRON_SECRET は2か所」を見る |
| `DATABASE_URL` | Supabase → Project Settings → Database → パスワードの再設定 | 再設定した時点で切り替わる。同じ Supabase を使うほかのアプリも書きかえが要る |

LINE と Slack と Supabase は、同じチャネルやプロジェクトをほかのアプリでも使っていれば、そちらの鍵も書きかえます。

### CRON_SECRET は2か所

1分ごとの呼び出しは、Supabase から Vercel に合言葉を付けて送っています。Vercel と Supabase の金庫（Vault）の両方を、同じ値に書きかえます。

```sql
-- Supabase の SQL Editor で
select vault.update_secret(
  (select id from vault.secrets where name = 'case5_cron_secret'),
  '<新しい CRON_SECRET>'
);
```

両方がそろうまでの1〜2分は、呼び出しが 401 になります。問い合わせは記録に残るので、そろったあとに順に処理されます。

## 取り替えたあとの確認

- [ ] LINE で「至急」を含むクレームを送り、部長の LINE と Slack の #問い合わせ-クレーム に数秒で届く
- [ ] 窓口のメールに問い合わせを送り、1〜2分で Slack の部屋に届く
- [ ] 古い合言葉で呼ぶと 401 になる

```bash
curl -i -H "Authorization: Bearer <古い CRON_SECRET>" https://multichannel-notify-ai.vercel.app/api/cron/classify
```

- [ ] `supabase/monitor.sql` の1を流し、「止まっている」「失敗」「クレーム5分超え」が 0

取り替えの間に3回失敗して「失敗」になった問い合わせは、次の SQL で未処理に戻すと、1分以内に処理し直されます。

```sql
update case5.inquiry_queue set status = 'pending', attempts = 0 where status = 'failed';
```
