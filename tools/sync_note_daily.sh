#!/bin/bash
# chiero.jp の「記録」を note の最新に合わせ、変化があれば公開する。
# launchd から日次で呼ばれる。人の操作は要らない。
#
# 安全側の作法:
#   - 取得に失敗したら何もしない（古い記録が残るほうが、消えるよりよい）
#   - 差分がなければコミットしない
#   - main 以外にいる時は触らない（作業中のブランチを巻き込まない）
#   - 生成対象は NOTE:START〜END の内側だけ。他の行に差分が出たら中止する

set -uo pipefail

REPO="$HOME/Desktop/Claude/chiero_site"
LOG="$REPO/tools/sync_note.log"
exec >> "$LOG" 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') ====="

cd "$REPO" || { echo "リポジトリが無い"; exit 1; }

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  echo "main ではなく $branch にいるので何もしない"
  exit 0
fi

if ! git diff --quiet -- corporate/v4/index.html; then
  echo "index.html に未コミットの手編集がある。巻き込まないよう中止"
  exit 0
fi

if ! /usr/bin/python3 tools/sync_note.py; then
  echo "note の取得に失敗。HTMLは無傷のまま終了"
  exit 0
fi

if git diff --quiet -- corporate/v4/index.html; then
  echo "変化なし"
  exit 0
fi

# 生成ブロックの外に差分が出ていないかを確認する（暴走の歯止め）
outside=$(git diff -U0 -- corporate/v4/index.html \
  | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE 'log-card|log-thumb|log-body|log-meta|log-title|log-mark|NOTE:START|NOTE:END|最終同期|assets\.st-note\.com|note\.com/kounkt|</?a |</?span |</?time|<img ' \
  | head -3)
if [ -n "$outside" ]; then
  echo "生成ブロック外に差分が出た。安全のため巻き戻す:"
  echo "$outside"
  git checkout -- corporate/v4/index.html
  exit 1
fi

git add corporate/v4/index.html
git -c user.name="kounkt" -c user.email="nkt1214@gmail.com" \
    commit -q -m "記録: note の最新を同期（自動）"
if git push -q origin main; then
  echo "公開した: $(git log --oneline -1)"
else
  echo "push に失敗。次回に持ち越す"
fi
