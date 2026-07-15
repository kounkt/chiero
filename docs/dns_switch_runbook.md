# chiero.jp DNS切替 手順書

**作成**: 2026-07-15 ／ **所要**: 約5分 ＋ 伝播待ち（最大1時間）
**前提**: この作業でメールは失われない。**@chiero.jp のメールアカウントは0件**であることを Xserver パネルで実査確認済み（メーリングリスト0・メールマガジン0も確認。詳細は `chiero_jp_backup/mail_investigation_2026-07-15.txt`）
**戻し方**: 切替前の全レコードは `chiero_jp_backup/dns_before_switch.txt` に記録済み

---

## ⚠️ この画面での注意（実地でヒヤリとした2件）

Xserverの「DNSレコード設定」は**編集を開くと再描画で行がずれる**。目視の位置で押すと違う行に当たる。実際に:
1. MXのつもりでNSレコードの編集を開いた（未実行でキャンセル）
2. ワイルドカード `*.chiero.jp` の**削除チェックボックス**を入れかけた（未実行で解除）

→ **必ず「ホスト名 / 種別 / 内容」の3つを目で読んでから**、その行の鉛筆アイコンを押すこと。

---

## 触ってはいけないレコード

| レコード | 理由 |
|---|---|
| `*.chiero.jp` A | ワイルドカード。他のサブドメインが依存している可能性 |
| `chiero.jp` NS ×5 | 触るとドメインごと死ぬ |
| `chiero.jp` TXT (SPF) | メール送信の認証 |
| `tokuten.chiero.jp` CNAME | **稼働中**（「読者限定特典」/ repo: kounkt/chiero-tokuten）。別リポジトリなので独立 |

---

## 手順

サーバーパネル → ドメイン → **DNSレコード設定** → 右上のプルダウンで **chiero.jp** を選択。

### ① MX を先に変える（メール機能を残すため）

対象行: **`chiero.jp` / `MX` / `chiero.jp`** ← 内容が「chiero.jp」であることを確認

鉛筆アイコン → 内容を書き換え → 設定する

| | 変更前 | 変更後 |
|---|---|---|
| 内容 | `chiero.jp` | **`sv7600.xserver.jp`** |
| TTL | 3600 | 3600（そのまま） |
| 優先度 | 0 | 0（そのまま） |

**なぜ先にやるか**: 今の MX は「chiero.jp」＝ドメイン自身を指しており、その解決は A レコードに依存している。A を先に GitHub へ向けると、**MXを触っていないのにメールの宛先が GitHub になる**。sv7600.xserver.jp は同じサーバ（183.90.241.121）で、SPFにも既に `+a:sv7600.xserver.jp` と書かれているので整合する。これをやっておけば、**将来 info@chiero.jp を作れる**。

### ② A を GitHub Pages へ向ける

対象行: **`chiero.jp` / `A` / `183.90.241.121`** ← ホスト名が `chiero.jp` のもの。`www.` や `*.` ではない

GitHub Pages の apex 用 IP は4本ある。**既存の1行を書き換え、残り3本は「DNSレコード設定を追加」で足す。**

| ホスト名 | 種別 | 内容 | TTL |
|---|---|---|---|
| chiero.jp（空欄でも可） | A | `185.199.108.153` | 3600 |
| chiero.jp | A | `185.199.109.153` | 3600 |
| chiero.jp | A | `185.199.110.153` | 3600 |
| chiero.jp | A | `185.199.111.153` | 3600 |

### ③ www を GitHub へ

対象行: **`www.chiero.jp` / `A` / `183.90.241.121`**

この行を**削除**し、代わりに追加:

| ホスト名 | 種別 | 内容 | TTL |
|---|---|---|---|
| www | CNAME | `kounkt.github.io` | 3600 |

（A のまま4本に書き換えてもよいが、CNAME の方がGitHub推奨）

---

## 切替後（AIが引き取れる）

DNSの伝播を確認したら、以下は私（AI）が実行できる:

1. 伝播確認 `dig +short A chiero.jp` → 185.199.x.x が返る
2. リポジトリの `CNAME.pending` を `CNAME` にリネームして push
3. GitHub Pages のカスタムドメインを chiero.jp に設定
4. Enforce HTTPS を有効化（証明書発行に数分〜十数分）
5. https://chiero.jp/ の表示確認
6. **Xserver側の旧WordPressを削除**（バックアップ確認後）
7. **launchd を設置**して note の日次同期を開始
8. Google Search Console に登録

**⚠️ 順序の鉄則**: CNAME は **DNSを向けた後**に置く。逆にすると `kounkt.github.io/chiero` が chiero.jp へ301し、その先がまだ旧サイトなので**新サイトが到達不能になる**（2026-07-15にこの事故を起こして即復旧した）。

---

## 検証コマンド（切替後にこれを流す）

```bash
dig +short A chiero.jp          # → 185.199.108-111.153 の4本
dig +short CNAME www.chiero.jp  # → kounkt.github.io.
dig +short MX chiero.jp         # → 0 sv7600.xserver.jp.
dig +short TXT chiero.jp        # → v=spf1 ... （変わっていないこと）
dig +short NS chiero.jp         # → ns1〜5.xserver.jp（変わっていないこと）
dig +short A test999.chiero.jp  # → 183.90.241.121（ワイルドカードが無傷なこと）
curl -sI https://tokuten.chiero.jp/ | head -1   # → 200（別サイトが無傷なこと）
```
