"""
運用マニュアル.md から、A4縦の PDF（運用マニュアル.pdf）を作る。

  python3 scripts/build-manual.py

書き方（.md の中）
  # / ## / ###      見出し
  - 文              箇条書き
  [図:名前]         図（下の FIGURES から選ぶ）
  [表:名前]         表（下の TABLES から選ぶ）
"""
import html
import os
import re
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "運用マニュアル.md")
OUT = os.path.join(ROOT, "運用マニュアル.pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

FIGURES = {
    "全体": """
<div class="fig overall">
  <div class="col">
    <div class="node">窓口のメール</div>
    <div class="node">公式LINE</div>
  </div>
  <div class="arrow">→</div>
  <div class="node strong">AIが読んで分ける<small>1分ごと／急ぎはすぐ</small></div>
  <div class="arrow">→</div>
  <div class="col">
    <div class="node slack">Slack<small>種類ごとの部屋</small></div>
    <div class="node alert">部長のLINE<small>クレームだけ・5分以内</small></div>
  </div>
</div>""",
    "部屋": """
<div class="fig rooms">
  <div class="room"><b>#問い合わせ-賃貸</b><span>借りたい・家賃・更新など</span></div>
  <div class="room"><b>#問い合わせ-売買</b><span>買いたい・売りたい</span></div>
  <div class="room"><b>#問い合わせ-内見</b><span>内見の申し込み・日程</span></div>
  <div class="room claim"><b>#問い合わせ-クレーム</b><span>不満・苦情・トラブル<br>部長のLINEにも届く</span></div>
  <div class="room other"><b>#問い合わせ-その他</b><span>どれにも当てはまらないもの</span></div>
</div>""",
    "通知": """
<div class="fig notice">
  <div class="msg">
    <div class="msg-head">🚨 <b>クレーム</b> の問い合わせ（LINE）<i>1</i></div>
    <div class="msg-quote">入居中の部屋で水漏れしています。至急来てください。<i>2</i></div>
    <div>AI の判断：水漏れへの苦情と至急の対応依頼のため<i>3</i></div>
    <div>受付：2026/11/10 16:17:02<i>4</i></div>
  </div>
  <ol class="keys">
    <li><b>種類と入り口</b>　クレームのときは 🚨 が付きます</li>
    <li><b>お客さまの文</b>　届いたままの文です</li>
    <li><b>AIの判断</b>　その種類にした理由です</li>
    <li><b>受付</b>　問い合わせが届いた時刻です</li>
  </ol>
</div>""",
}

TABLES = {
    "困ったとき": [
        ("こんなとき", "すること"),
        ("通知がしばらく来ない", "開発担当に連絡してください。届いた問い合わせは記録に残るので、直ったあとに順に届きます。"),
        ("メールの通知だけ来ない", "開発担当に連絡してください。メールとのつながりを、つなぎ直すことがあります。"),
        ("分け方が違う", "その通知を開発担当に転送してください。"),
        ("急ぎの言葉を増やしたい", "開発担当に連絡してください。言葉の追加はこちらで行います。"),
        ("部長以外にもLINEで届けたい", "開発担当に相談してください。追加の作業になります。"),
    ],
}


def table(rows):
    head, *body = rows
    out = ['<table><thead><tr>' + "".join(f"<th>{html.escape(c)}</th>" for c in head) + "</tr></thead><tbody>"]
    for r in body:
        out.append("<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in r) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def convert(md):
    out, list_open = [], False

    def close_list():
        nonlocal list_open
        if list_open:
            out.append("</ul>")
            list_open = False

    for raw in md.split("\n"):
        line = raw.rstrip()
        if not line:
            close_list()
            continue
        m = re.match(r"^\[(図|表):(.+)\]$", line)
        if m:
            close_list()
            out.append(FIGURES[m.group(2)] if m.group(1) == "図" else table(TABLES[m.group(2)]))
            continue
        m = re.match(r"^(#{2,3}) (.*)$", line)
        if m:
            close_list()
            level = len(m.group(1))
            out.append(f"<h{level}>{html.escape(m.group(2))}</h{level}>")
            continue
        m = re.match(r"^- (.*)$", line)
        if m:
            if not list_open:
                out.append("<ul>")
                list_open = True
            out.append(f"<li>{html.escape(m.group(1))}</li>")
            continue
        close_list()
        out.append(f"<p>{html.escape(line)}</p>")
    close_list()
    # 見出しごとにまとまりで包み、ページの途中で切れないようにする
    blocks = re.split(r"(?=<h2>)", "\n".join(out))
    return "\n".join(f'<section class="blk">{b}</section>' for b in blocks if b.strip())


CSS = """
@page { size: A4 portrait; margin: 14mm 14mm 14mm; }
:root { --accent: #2f4a6b; --soft: #eef2f6; --line: #d9dee5; --text: #24292f; --sub: #6b7280; --red: #b42318; --redsoft: #fdecea; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; color: var(--text); font-size: 10pt; line-height: 1.7; }
h1 { font-size: 17pt; margin: 0 0 4pt; color: var(--accent); }
.lead { margin-bottom: 8pt; padding-bottom: 8pt; border-bottom: 2px solid var(--soft); color: var(--sub); }
.lead p { margin: 0; }
.blk { break-inside: avoid; }
h2 { font-size: 12.5pt; margin: 14pt 0 5pt; padding: 3pt 9pt; background: var(--soft); border-left: 4pt solid var(--accent); border-radius: 2pt; }
h3 { font-size: 10.8pt; margin: 9pt 0 3pt; color: var(--accent); }
h3::before { content: "▸ "; }
p { margin: 3pt 0; }
ul { margin: 2pt 0 4pt; padding-left: 1.2em; }
li { margin: 1.5pt 0; }
.fig { margin: 6pt 0 8pt; padding: 10pt 12pt; border: 1px solid var(--line); border-radius: 6pt; background: #fff; }
.node { padding: 6pt 12pt; border: 1px solid #c8d0da; border-radius: 5pt; background: #f8fafc; text-align: center; font-weight: 600; line-height: 1.35; }
.node small { display: block; font-size: 8pt; font-weight: 400; color: var(--sub); }
.node.strong { background: var(--accent); border-color: var(--accent); color: #fff; }
.node.strong small { color: #dbe4ee; }
.node.slack { background: #f3eefb; border-color: #d7c8ef; color: #4a2a7a; }
.node.alert { background: var(--redsoft); border-color: #f3b8b1; color: var(--red); }
.arrow { color: var(--accent); font-weight: 700; font-size: 15pt; }
.overall { display: flex; align-items: center; justify-content: space-between; gap: 8pt; }
.overall .col { display: flex; flex-direction: column; gap: 8pt; flex: 1; }
.overall > .node.strong { flex: 1.1; padding: 12pt 8pt; }
.rooms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7pt; }
.room { border: 1px solid var(--line); border-radius: 5pt; padding: 6pt 8pt; background: #f8fafc; }
.room b { display: block; font-size: 9.4pt; color: var(--accent); }
.room span { font-size: 8.6pt; color: var(--sub); line-height: 1.45; display: block; }
.room.claim { background: var(--redsoft); border-color: #f3b8b1; }
.room.claim b { color: var(--red); }
.notice { display: grid; grid-template-columns: 1.15fr 1fr; gap: 12pt; align-items: center; }
.msg { border-left: 4pt solid #d7c8ef; padding: 6pt 10pt; background: #fbfaff; font-size: 9pt; line-height: 1.6; }
.msg > div { position: relative; padding-right: 18pt; }
.msg-quote { border-left: 3pt solid #d0d5dc; padding-left: 7pt; margin: 3pt 0; color: #3b4148; }
.msg i, .keys li::marker { font-style: normal; }
.msg i { position: absolute; right: 0; top: 1pt; width: 13pt; height: 13pt; border-radius: 50%; background: var(--accent); color: #fff; font-size: 7.5pt; text-align: center; line-height: 13pt; }
.keys { margin: 0; padding-left: 1.3em; font-size: 9pt; }
.keys li { margin: 3pt 0; }
.keys li::marker { color: var(--accent); font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 6pt; font-size: 9.4pt; }
th, td { border: 1px solid var(--line); padding: 5pt 8pt; text-align: left; vertical-align: top; }
th { background: var(--soft); color: var(--accent); }
td:first-child { width: 34%; font-weight: 600; }
"""


def main():
    md = open(SRC, encoding="utf-8").read()
    lines = md.split("\n")
    title = re.match(r"^# (.*)$", lines[0]).group(1)
    body = convert("\n".join(lines[1:]))
    # はじめのひとこと（# の直後の段落）を上に出す
    first = re.match(r'<section class="blk">(.*?)</section>', body, re.S)
    lead, rest = (first.group(1), body[first.end():]) if first and "<h2>" not in first.group(1) else ("", body)
    doc = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>{CSS}</style></head><body>
<h1>{html.escape(title)}</h1><div class="lead">{lead}</div>{rest}</body></html>"""
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, "manual.html")
        open(page, "w", encoding="utf-8").write(doc)
        subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
             f"--user-data-dir={os.path.join(tmp, 'chrome')}", "--no-pdf-header-footer",
             f"--print-to-pdf={OUT}", "file://" + page],
            check=True, capture_output=True,
        )
    pages = len(re.findall(rb"/Type\s*/Page[^s]", open(OUT, "rb").read()))
    print(f"作りました: {OUT}（{pages}ページ）")


if __name__ == "__main__":
    main()
