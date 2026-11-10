// Slack にメッセージを送る部品。
import type { Category } from "@/lib/classify";

// 種類ごとの送り先（チャネルの番号は .env.local）
export const SLACK_CHANNELS: Record<Category, string | undefined> = {
  賃貸: process.env.SLACK_CHANNEL_RENT,
  売買: process.env.SLACK_CHANNEL_SALE,
  内見: process.env.SLACK_CHANNEL_VIEWING,
  クレーム: process.env.SLACK_CHANNEL_CLAIM,
  その他: process.env.SLACK_CHANNEL_OTHER,
};

export async function postToSlack(channel: string, text: string): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({ channel, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack に送れませんでした: ${data.error}`);
}

const CHANNEL_LABEL = { line: "LINE", gmail: "メール" } as const;

export function formatMessage(row: {
  channel: "line" | "gmail";
  raw_content: string;
  created_at: Date;
}, category: Category, reason: string): string {
  const time = row.created_at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const quoted = row.raw_content.split("\n").map((l) => `> ${l}`).join("\n");
  return [
    `*${category}* の問い合わせ（${CHANNEL_LABEL[row.channel]}）`,
    quoted,
    `AI の判断：${reason}`,
    `受付：${time}`,
  ].join("\n");
}
