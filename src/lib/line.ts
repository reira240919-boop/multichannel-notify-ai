// 部長の個人 LINE に知らせる部品（LINE Push）。
export async function pushToManager(text: string): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: process.env.LINE_MANAGER_USER_ID,
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) throw new Error(`部長の LINE に送れませんでした: ${res.status} ${await res.text()}`);
}
