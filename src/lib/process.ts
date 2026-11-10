// 問い合わせを AI で分け、Slack と（クレームなら）部長の LINE に知らせる。
// 1分ごとの道（processPending）と、緊急の道（handleUrgent）の両方がここを使う。
import { sql, saveInquiry, type Channel } from "@/lib/db";
import { classifyWithClaude, type Category } from "@/lib/classify";
import { SLACK_CHANNELS, postToSlack, formatMessage } from "@/lib/slack";
import { pushToManager } from "@/lib/line";

const BATCH = 20; // 1回に取り出す数
const MAX_ATTEMPTS = 3; // これだけ失敗したら「失敗」にする

// 受け取った時点で、緊急かもしれない言葉
const URGENT_WORDS = /クレーム|至急|苦情|怒り|緊急/;
export const looksUrgent = (text: string) => URGENT_WORDS.test(text);

type Row = {
  id: string;
  channel: Channel;
  raw_content: string;
  created_at: Date;
  attempts: number;
  category: Category | null;
  ai_reason: string | null;
  notified_at: Date | null;
  line_notified_at: Date | null;
};

const COLUMNS = sql`id, channel, raw_content, created_at, attempts, category, ai_reason, notified_at, line_notified_at`;

// 1件を最後まで処理する。
// 途中で失敗してやり直すときに、済んだところ（分類・Slack・LINE）は繰り返さない。
async function handleOne(row: Row): Promise<void> {
  try {
    let category = row.category;
    let reason = row.ai_reason ?? "";
    if (!category) {
      ({ category, reason } = await classifyWithClaude(row.raw_content));
      await sql`
        update case5.inquiry_queue
        set status = 'classified', category = ${category}, ai_reason = ${reason}, classified_at = now()
        where id = ${row.id}
      `;
    }

    const isClaim = category === "クレーム";
    const message = formatMessage(row, category, reason);

    if (!row.notified_at) {
      const channelId = SLACK_CHANNELS[category];
      if (!channelId) throw new Error(`${category} の Slack チャネルが設定されていません`);
      await postToSlack(channelId, isClaim ? `🚨 ${message}` : message);
      await sql`update case5.inquiry_queue set notified_at = now() where id = ${row.id}`;
    }

    if (isClaim && !row.line_notified_at) {
      await pushToManager(`🚨 クレームの問い合わせです\n\n${message.replace(/\*|> /g, "")}`);
      await sql`update case5.inquiry_queue set line_notified_at = now() where id = ${row.id}`;
    }

    await sql`update case5.inquiry_queue set status = 'notified' where id = ${row.id}`;
  } catch (e) {
    console.error(`処理に失敗（${row.id}・${row.attempts}回目）:`, e);
    const next = row.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    await sql`update case5.inquiry_queue set status = ${next} where id = ${row.id}`;
    throw e;
  }
}

// 1分ごとの道：未処理をまとめて取り出して処理する
export async function processPending() {
  // 取り出すと同時に「処理中」の印をつける。
  // 前の回がまだ動いていても、同じ行を2回取らない（skip locked）。
  // 「処理中」のまま5分たったものは、途中で止まったとみなしてやり直す。
  const rows = await sql<Row[]>`
    update case5.inquiry_queue
    set status = 'processing', picked_at = now(), attempts = attempts + 1
    where id in (
      select id from case5.inquiry_queue
      where status = 'pending'
         or (status = 'processing' and picked_at < now() - interval '5 minutes')
      order by created_at
      limit ${BATCH}
      for update skip locked
    )
    returning ${COLUMNS}
  `;

  let notified = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await handleOne(row);
      notified++;
    } catch {
      failed++;
    }
  }
  return { picked: rows.length, notified, failed };
}

// 届いた問い合わせを記録する。緊急の言葉があれば、列を待たずにすぐ処理する。
// 同じメッセージがもう入っていれば何もしない（重複防止）。
export async function receive(input: { channel: Channel; externalId: string; text: string }) {
  const urgent = looksUrgent(input.text);
  const id = await saveInquiry({ ...input, urgent });
  if (!id || !urgent) return { saved: !!id, urgent: false };

  const [row] = await sql<Row[]>`select ${COLUMNS} from case5.inquiry_queue where id = ${id}`;
  try {
    await handleOne(row);
  } catch {
    // 失敗しても「未処理」に戻っているので、1分ごとの道がやり直す
  }
  return { saved: true, urgent: true };
}
