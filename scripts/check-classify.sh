#!/bin/zsh
# Headless モード（claude -p）で、テスト用 CSV 22件の答え合わせをする。
# 使い方: ./scripts/check-classify.sh
# Claude に許すのは「答え合わせの道具を動かす」と「ファイルを読む」だけ。書き換えはさせない。
cd "$(dirname "$0")/.."

claude -p "$(cat scripts/check-classify.prompt.md)" \
  --allowedTools "Bash(node --env-file=.env.local scripts/try-classify.mjs)" "Read" \
  --disallowedTools "Edit" "Write" \
  --output-format text
