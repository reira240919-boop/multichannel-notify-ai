// Gmail（問い合わせ窓口のアカウント）を見にいき、新しく届いたメールを表に記録する部品。
// 「どこまで見たか」は case5.gmail_state に覚えておく。
import { gmail, auth } from "@googleapis/gmail";
import { sql } from "@/lib/db";
import { receive } from "@/lib/process";

function client() {
  const oauth = new auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return gmail({ version: "v1", auth: oauth });
}

type Part = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: Part[] | null;
};

// メールの中から、ふつうの文（text/plain）を探して取り出す
function findPlainText(part: Part | undefined): string | null {
  if (!part) return null;
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const p of part.parts ?? []) {
    const found = findPlainText(p);
    if (found) return found;
  }
  return null;
}

async function saveHistoryId(historyId: string) {
  await sql`
    insert into case5.gmail_state (id, history_id) values (1, ${historyId})
    on conflict (id) do update set history_id = excluded.history_id, updated_at = now()
  `;
}

// 新しく届いたメールを取りこむ。取りこんだ件数を返す。
export async function pollGmail(): Promise<{ saved: number; note?: string }> {
  const g = client();
  const [state] = await sql`select history_id from case5.gmail_state where id = 1`;

  // 初めて見るとき：今ある古いメールは取りこまず、「ここから先」の印だけ付ける
  if (!state) {
    const profile = await g.users.getProfile({ userId: "me" });
    await saveHistoryId(profile.data.historyId!);
    return { saved: 0, note: "初回のため、印だけ付けました" };
  }

  let history;
  try {
    history = await g.users.history.list({
      userId: "me",
      startHistoryId: state.history_id,
      // 新しく届いたメールと、迷惑メールなどから受信トレイに戻されたメールの両方を見る
      historyTypes: ["messageAdded", "labelAdded"],
      labelId: "INBOX",
    });
  } catch (e) {
    // 印が古すぎる（おおむね1週間以上前）と Google が 404 を返す。今の位置から付け直す
    if ((e as { code?: number }).code === 404) {
      const profile = await g.users.getProfile({ userId: "me" });
      await saveHistoryId(profile.data.historyId!);
      return { saved: 0, note: "印が古かったため、付け直しました" };
    }
    throw e;
  }

  const ids = new Set<string>();
  for (const h of history.data.history ?? []) {
    for (const m of h.messagesAdded ?? []) {
      if (m.message?.id && m.message.labelIds?.includes("INBOX")) ids.add(m.message.id);
    }
    for (const l of h.labelsAdded ?? []) {
      if (l.message?.id && l.labelIds?.includes("INBOX")) ids.add(l.message.id);
    }
  }

  let saved = 0;
  for (const id of ids) {
    const msg = await g.users.messages.get({ userId: "me", id, format: "full" });
    const headers = msg.data.payload?.headers ?? [];
    const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "（件名なし）";
    const body = findPlainText(msg.data.payload as Part) ?? msg.data.snippet ?? "";
    const text = `件名: ${subject}\n${body.trim()}`;
    // 緊急の言葉があれば、ここで列を待たずに処理する
    if ((await receive({ channel: "gmail", externalId: `gmail:${id}`, text })).saved) saved++;
  }

  if (history.data.historyId) await saveHistoryId(history.data.historyId);
  return { saved };
}
