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
