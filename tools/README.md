# tools/

## sync_note.py

note の最新記事を `index.html` の「記録」セクションへ焼き込む。

**GitHub Actions（`.github/workflows/sync-note.yml`）が毎朝 07:10 JST に実行する。**
GitHub のサーバーで動くので、**Mac の電源とは無関係**。

手元で試すとき:

```bash
python3 tools/sync_note.py --dry-run   # 取得内容を見るだけ。HTMLに触れない
python3 tools/sync_note.py             # HTMLを更新する
```

## 設計の要点（なぜこうなっているか）

- **JSで取りに行かない**: note の RSS には CORS ヘッダが無く、そもそも本文を
  JSに依存させない方針のため、日次でこちらから取りに行きHTMLへ直接書き込む。
  訪問者のブラウザは何もしない
- **取得に失敗したらHTMLに触れない**: 古い記録が残るほうが、消えるよりよい
- **生成ブロックの外に差分が出たら中止**: `NOTE:START`〜`NOTE:END` の内側だけが
  生成対象。それ以外が動いたらワークフローが失敗して止まる

## 履歴

- 2026-07-15: launchd（`com.chiero.syncnote.plist` / `sync_note_daily.sh`）で
  運用開始 → 同日 GitHub Actions へ移行して削除。理由は **LaunchAgent が
  ログイン中のユーザーセッションでしか動かず、MacBook を閉じている間は
  走らなかったため**。
## sync_interviews.py / sync_interviews.sh（2026-09-12〜）

Threads の投稿（@chiero_piero）から「〇〇県さんの面接」を拾い、`interviews/index.html`・
`en/interviews/index.html` の生成ブロック（`INTERVIEWS:LATEST / GRID / META`）と
`interviews/data.json` を書き換える。改訂版・二次面接・市の回（博多・川崎市）も同じ県の欄に並ぶ。

- 判別は投稿の1行目（題名）だけを見る。「改訂版」「二次面接」の語で種類を決める
- 題名に表記がない例外（愛知の改訂版など）は `interviews_overrides.json` に書く
- 47都道府県のうち 40 未満しか拾えなければ API 異常とみなして書かない
- `sync_interviews.sh` は fast-forward pull → 生成 → `consistency.py` / `i18n_check.py` →
  変更が対象4ファイルだけなら commit → push → IndexNow 通知。作業ツリーに他の変更があれば触らない
- 実行は **Mac の launchd**（`com.chiero.interviews-sync`、07:25 / 12:35 / 13:10 / 19:50 / 20:25）。
  Threads のトークンは `~/Library/Application Support/Chiero/threads-api/token.json`（予約投稿と共用）に
  あるため GitHub Actions では回さない。Mac がスリープ中は次の起動時まで反映されない。
  ログ: `~/Library/Logs/chiero-interviews-sync.log`

```bash
python3 tools/sync_interviews.py --dry-run     # 判別結果だけ表示。HTMLに触れない
python3 tools/sync_interviews.py               # 取得して HTML / data.json を更新
tools/sync_interviews.sh                       # 更新して公開まで（launchd と同じ手順）
launchctl unload ~/Library/LaunchAgents/com.chiero.interviews-sync.plist   # 自動同期を止める
```

# IndexNow

更新したURLをBingなどのIndexNow参加検索エンジンへ通知する。HTTP成功は受領のみを示し、インデックス登録を保証しない。

```sh
tools/submit_indexnow.sh https://chiero.jp/ai-search/ https://chiero.jp/llms.txt
```
