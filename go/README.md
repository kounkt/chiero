# go/ — 動画のQRコード用の転送ページ

`https://chiero.jp/go/gpt/` は、動画に焼き込むQRコードの行き先です。QRコードは公開後に差し替えられないため、QRには chiero.jp のURLを入れ、このページが開いた人を転送先へ送ります。転送先を替える時はQRコードではなくこのページを書き替えます。

- 2026-10-01 作成。転送先は講座LP `https://utage-system.com/p/tyquKDxAqSOo`。
- 講座用のLINE公式アカウントの準備ができたら、転送先をLINEの友だち追加URLへ替える予定。
- 検索に出さないため `noindex` を付けている。`sitemap.xml` と `llms.txt` には載せない。

## ページの動き

`go/gpt/index.html` が次の3つの方法で転送先へ送ります。

1. JavaScript が本文のリンク（`id="go"`）の URL を読み、`utm_content` を付け替えて `location.replace` で移動する。
2. JavaScript が動かない時は、`<noscript>` の中の `<meta http-equiv="refresh">` が既定の URL へ移動する。
3. どちらも動かない時のために、本文に「講座のページへ進む」のリンクを置いている。

`?c=値` が付いていると、その値を `utm_content` として転送先へ渡します。英数字・ハイフン・アンダースコアだけで40字以内の値だけを渡し、それ以外の値や `c` が無い時は `utm_content=qr` にします。転送先のURLそのものをクエリで指定する機能はありません。

例：`https://chiero.jp/go/gpt/?c=intro_qr` → `…&utm_content=intro_qr`

## 転送先の替え方

`go/gpt/index.html` の次の2行にある URL を、2行とも同じ値に替えます。JavaScript はリンクの URL を読むので、スクリプトは変更しません。

- `<noscript><meta http-equiv="refresh" content="0; url=…">` の行
- `<a id="go" href="…">講座のページへ進む</a>` の行

URL の中の `&` は、HTML の中では `&amp;` と書きます。UTM（`utm_source=youtube`・`utm_medium=qr`・`utm_campaign=ai_gpt_youtube`）を替える時も同じ2行を直します。末尾の `utm_content=qr` は残します。

LINEの友だち追加URLへ替える例（`NEW` を実際のURLに置き換える）：

```bash
cd ~/Desktop/Claude/chiero_site
OLD='https://utage-system.com/p/tyquKDxAqSOo?'
NEW='https://lin.ee/XXXXXXX?'
sed -i '' "s#${OLD}#${NEW}#g" go/gpt/index.html
grep -c "${NEW}" go/gpt/index.html   # 2 と出れば2行とも替わっている
```

## 替えた後の確かめ方

1. 2行のURLが同じか確かめる。

   ```bash
   python3 - <<'PY'
   import re,html
   s=open('go/gpt/index.html').read()
   a=html.unescape(re.search(r'http-equiv="refresh" content="0; url=([^"]+)"',s)[1])
   b=html.unescape(re.search(r'id="go" href="([^"]+)"',s)[1])
   print(a); print('一致' if a==b else '不一致')
   PY
   ```

2. 手元で開く。`python3 -m http.server 8932` を chiero_site で動かし、ブラウザで `http://localhost:8932/go/gpt/?c=intro_qr` を開いて、移動先の URL に `utm_content=intro_qr` が付くことを見る。
3. 変更したのが `go/gpt/index.html` だけであることを `git status --short` で確かめてから、そのファイルだけをコミットして push する（push の前に autostash なしで `git pull --rebase`）。
4. 配信後に `curl -s 'https://chiero.jp/go/gpt/?c=test_check' | grep -E 'refresh|id="go"'` で、公開されたページの2行が新しい URL になったことを確かめる。転送先まで実際に開く確認は1回だけにし、`?c=internal_check` を付ける（転送先のアクセス数に数えられるため）。

## 別の動画用に増やす時

`go/gpt/` をフォルダごと複製して `go/新しい名前/` を作り、2行の URL と `utm_campaign` を替えます。

---

# /go/line/ — 講座用LINE（チエロのAI講座）の登録へ送るページ

2026-10-01 作成（CEOの依頼）。YouTubeの概要欄・固定コメント・QR、Threads、広告の専用LPに置くLINEのURLは、すべて `https://chiero.jp/go/line/?c=<識別子>` にそろえる。仕様の正本は `output/chiero-osaru-funnel-20261001/LAUNCH_ENTRANCES.md` §3。

## 開ける・止める

`go/line/index.html` の頭にある次の1行だけを変える。

```js
var OPEN = false;   // 止める（公開した時の状態）
var OPEN = true;    // 開ける
```

- `false`（止める）：どの識別子で来ても転送しない。「ただいま、新しい登録の受付を止めています。」の文と、講座のページ・無料公開レッスンの再生リストへのリンクを出す。
- `true`（開ける）：`?c=` の値が下の対応表にあれば、その登録経路へ `location.replace` で移動する。`c` が無い時・表に無い時は `yt_qr_common` へ移動する。
- JavaScript が動かない時は、`OPEN` の値にかかわらず、止めている時の文とリンクを出す（転送はしない）。

変えた後は、`go/line/index.html` だけをコミットして push する（push の前に autostash なしで `git pull --rebase`）。GitHub Pages の build が終わってから、下の「確かめ方」を行う。GitHub Pages は最大10分ほどキャッシュするため、切り替えが全員に効くまで最大10分ほどかかる。

## 対応表

`go/line/index.html` の下の `ROUTES` に1か所だけ持つ。URLの頭はどれも `https://utage-system.com/line/open/8p8wmjZRy3NQ`（シナリオA「01_登録直後」）。

| 識別子 | mtid |
|---|---|
| yt_desc_eahMO2HX29s | 4rQ1aggr5Mv6 |
| yt_desc_YE4QNBxRSec | bU70RJu6NQNz |
| yt_pin_common | DnEVxZaUiXuv |
| yt_qr_common（既定） | RP1HcpxiI8ek |
| lp_course | fUyMbseghjFl |
| ad_pos_a_keihi | 9qi7YQCKwmbx |
| ad_pos_b_gijiroku | zYiwqLUx8vnF |
| ad_pos_c_shokuba | llESJuZCPNQd |

- `internal_check` は表に入れない（社内の確認用の経路は、UTAGEのURLを直接開く）。
- 経路を足す時は、UTAGEで発行された後に、`ROUTES` に1行足す。発行前の識別子（`yt_desc_8R_CVoXUysc`・`yt_desc_samples`・`threads_common` など）で来た人は、足すまで `yt_qr_common` に数えられる。
- 転送先のURLそのものをクエリで受け取る機能はない。表に無い値は、既定の経路へ送る。

## 確かめ方

止めている時：

```bash
curl -s 'https://chiero.jp/go/line/?c=test_check' | grep -E 'var OPEN|noindex|受付を止めています'
```

`var OPEN = false;`・`noindex`・止めている文の3行が出ればよい。ブラウザで `?c=yt_pin_common` を開き、URLが chiero.jp のまま変わらないことを見る。

開けた時：

1. 上の curl で `var OPEN = true;` を確かめる。
2. 転送先まで実際に開く確認は、表に無い値で1回だけ行い、移動先が `…?mtid=RP1HcpxiI8ek`（`yt_qr_common`）になることを見る。友だち追加までは進まない（登録すると経路の数に入るため）。
3. 表にある識別子は、ブラウザで開いた時の移動先のURL（mtid）を見る。UTAGEの画面は開いてもよいが、友だち追加はしない。
