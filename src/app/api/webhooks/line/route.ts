// LINE の受け取り口。
// 届いた文を表に記録する。緊急の言葉があれば、列を待たずにすぐ AI で判断して知らせる（フェーズ 4）。
// LINE には先に「受け取った」と返し、処理はそのあとで行う（after）。
import crypto from "node:crypto";
import { after } from "next/server";
import { receive } from "@/lib/process";

// LINE から届いたかを、合言葉（チャネルシークレット）で確かめる
function isValidSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest();
  const given = Buffer.from(signature, "base64");
  // 時間の差から合言葉を推測されにくい比べ方
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

type LineEvent = {
  type: string;
  source?: { userId?: string };
  message?: { id: string; type: string; text?: string };
};

export async function POST(req: Request) {
  const body = await req.text();

  if (!isValidSignature(body, req.headers.get("x-line-signature"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const events: LineEvent[] = JSON.parse(body).events ?? [];
  for (const ev of events) {
    // パソコンで試すときだけ、送ってきた人の ID を出す（部長役の宛先を調べるため）
    if (process.env.NODE_ENV !== "production") console.log("[LINE] userId:", ev.source?.userId);

    if (ev.type !== "message" || ev.message?.type !== "text" || !ev.message.text) continue;

    const input = { channel: "line" as const, externalId: `line:${ev.message.id}`, text: ev.message.text };
    after(() => receive(input));
  }

  return new Response("OK");
}
