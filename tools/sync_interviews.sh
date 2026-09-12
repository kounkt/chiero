#!/bin/zsh
# Threads の最新投稿を chiero.jp/interviews/ へ反映し、変化があれば公開（git push）する。
# launchd（com.chiero.interviews-sync）が投稿枠のあとに呼ぶ。手動でも実行できる。
#
# 安全側:
#   - 先に origin/main を fast-forward で取り込む。取り込めなければ何もせず終わる
#   - 作業ツリーに他の未コミット変更があれば触らない（人の作業を巻き込まない）
#   - 変更対象は interviews/ と en/interviews/ と sitemap.xml だけ。それ以外が動いたら中止
set -u
export PATH="/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
REPO="/Users/nakatakosuke/Desktop/Claude/chiero_site"
ALLOWED=(interviews/index.html interviews/data.json en/interviews/index.html sitemap.xml)
cd "$REPO" || exit 1
echo "[$(date '+%F %T')] sync_interviews start"

if [ -n "$(git status --porcelain)" ]; then
  echo "作業ツリーに未コミットの変更がある。今回は触らない"; git status --short | head; exit 0
fi
if ! git pull --ff-only --quiet origin main; then
  echo "origin/main を fast-forward で取り込めない。今回は触らない"; exit 0
fi
if ! /usr/bin/python3 tools/sync_interviews.py; then
  echo "取得または生成に失敗。HTML は無傷"; git checkout -- . 2>/dev/null; exit 0
fi
changed=$(git status --porcelain | awk '{print $2}')
if [ -z "$changed" ]; then echo "変化なし"; exit 0; fi
for f in ${(f)changed}; do
  if [[ ! " ${ALLOWED[*]} " == *" $f "* ]]; then
    echo "想定外のファイルが変わった: $f 。安全のため中止"; git checkout -- .; exit 1
  fi
done
if ! /usr/bin/python3 tools/consistency.py >/tmp/interviews_consistency.log 2>&1 || ! /usr/bin/python3 tools/i18n_check.py >/tmp/interviews_i18n.log 2>&1; then
  echo "整合チェックに失敗。公開しない"; tail -5 /tmp/interviews_consistency.log /tmp/interviews_i18n.log; git checkout -- .; exit 1
fi
git add -- ${ALLOWED[@]}
git -c user.name="chiero-interviews-sync" -c user.email="info@chiero.jp" commit -q -m "面接: Threadsの最新を同期（自動）" || exit 0
if git push -q origin main; then
  echo "公開した: $changed"
  tools/submit_indexnow.sh https://chiero.jp/interviews/ https://chiero.jp/en/interviews/ >/dev/null 2>&1 || true
else
  echo "push に失敗。次回に持ち越す（コミットは残る）"
fi
