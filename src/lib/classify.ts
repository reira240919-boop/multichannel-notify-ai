// 問い合わせ文を AI（Claude）で種類に分ける部品。
// 答えは決まった形（JSON）で受け取るので、文の言い回しに左右されない。
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const CATEGORIES = ["賃貸", "売買", "内見", "クレーム", "その他"] as const;
export type Category = (typeof CATEGORIES)[number];

const ResultSchema = z.object({
  category: z.enum(CATEGORIES),
  reason: z.string(), // Slack に添える短い理由
});
export type ClassifyResult = z.infer<typeof ResultSchema>;

const SYSTEM = `あなたは不動産管理会社の問い合わせ窓口です。届いた問い合わせを、次のどれか1つに分けてください。

- 賃貸：部屋を借りたい、賃貸の条件や契約・更新・退去の相談
- 売買：物件を買いたい・売りたい、査定、ローンの相談
- 内見：物件を見に行く日程の相談が中心のもの
- クレーム：苦情、不具合への強い不満、至急の対応を求めるもの
- その他：不動産と関係のない内容

迷うときは、相手がいちばん求めていることで決めてください。
「至急」や「緊急」という言葉だけで決めず、中身で判断してください（「緊急ではありません」はクレームではない）。
reason は日本語で30文字以内。`;

const client = new Anthropic();

export async function classifyWithClaude(text: string): Promise<ClassifyResult> {
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: zodOutputFormat(ResultSchema),
    },
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`分類できませんでした（stop_reason: ${response.stop_reason}）`);
  }
  return response.parsed_output;
}
