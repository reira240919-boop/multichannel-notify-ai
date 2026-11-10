// 1分ごとに呼ばれる呼び出し口（呼ぶのは Supabase の定期実行。設定はフェーズ 5）。
// ① Gmail を見にいく → ② 未処理を AI で分けて Slack に送る
// 合言葉（CRON_SECRET）が無い呼び出しは断る。
import { pollGmail } from "@/lib/gmail";
import { processPending } from "@/lib/process";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Gmail が止まっていても、LINE の分は処理を続ける
  let gmail;
  try {
    gmail = await pollGmail();
  } catch (e) {
    console.error("Gmail を見にいけませんでした:", e);
    gmail = { error: "Gmail を見にいけませんでした" };
  }

  const result = await processPending();
  return Response.json({ gmail, ...result });
}
