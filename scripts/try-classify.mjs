// CSV の数件を classifyWithClaude に直接渡して、分類が合うか試す。
// 使い方: node --env-file=.env.local scripts/try-classify.mjs 1 11 15 19 21
import fs from "node:fs";
import { classifyWithClaude } from "../src/lib/classify.ts";

const rows = fs
  .readFileSync("case5-test-inquiries.csv", "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [no, channel, text, expected] = line.split(",");
    return { no, channel, text, expected };
  });

const picks = process.argv.slice(2);
const targets = picks.length ? rows.filter((r) => picks.includes(r.no)) : rows;

let ok = 0;
for (const r of targets) {
  const result = await classifyWithClaude(r.text);
  const hit = r.expected.startsWith(result.category);
  if (hit) ok++;
  console.log(`${hit ? "○" : "×"} ${r.no}番 期待:${r.expected} → AI:${result.category}（${result.reason}）`);
}
console.log(`\n${ok} / ${targets.length} 件 一致`);
