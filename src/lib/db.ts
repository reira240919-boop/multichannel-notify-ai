// データベース（Supabase の case5 スキーマ）につなぐ部品。
// case5 は外向けの API に出していないので、サーバーの中から直接つなぐ。
import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    prepare: false, // Supabase の中継（6543番）では prepare を使えない
    max: 1,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export type Channel = "line" | "gmail";

// 届いた問い合わせを表に記録する。
// 同じメッセージ番号がもう入っていれば何もしない（重複防止）。
// 新しく入ったらその行の id、すでにあったら null を返す。
// 緊急（urgent）のものは、1分ごとの道に取られないよう、最初から「処理中」で入れる。
export async function saveInquiry(input: {
  channel: Channel;
  externalId: string;
  text: string;
  urgent?: boolean;
}): Promise<string | null> {
  const urgent = input.urgent ?? false;
  const rows = await sql`
    insert into case5.inquiry_queue (channel, external_id, raw_content, is_urgent, status, picked_at, attempts)
    values (
      ${input.channel}, ${input.externalId}, ${input.text}, ${urgent},
      ${urgent ? "processing" : "pending"}, ${urgent ? new Date() : null}, ${urgent ? 1 : 0}
    )
    on conflict (external_id) do nothing
    returning id
  `;
  return rows.length > 0 ? (rows[0].id as string) : null;
}
