# go/ — 動画のQRコード用の転送ページ

`https://chiero.jp/go/gpt/` は、動画に焼き込むQRコードの行き先です。QRコードは公開後に差し替えられないため、QRには chiero.jp のURLを入れ、このページで行き先を決めます。行き先を替える時はQRコードではなくこのページを書き替えます。

- 2026-10-01 作成。当初の転送先は UTAGE の講座の販売ページ。
- 2026-11（UTAGE の解約に合わせて）：**転送をやめ「閉じる形」にした。** 「ChatGPT講座の受付を終えました。」と、次の行き先3つ（YouTube の無料公開レッスンの再生リスト・`/ai/chatgpt-guide/`・公式LINE の `/go/official/yt/`）を出すだけのページ。QR で来た人が行き止まりにならない。Cloudflare のビーコンで訪問を数える。
- 講座を公式サイトへ移す時は、下の「ページの動き」の転送の形（git の `c7165676` の版）に戻し、2行の URL を新しい案内ページに替える。
- 検索に出さないため `noindex` を付けている。`sitemap.xml` と `llms.txt` には載せない。

## ページの動き（転送の形に戻す時の説明・今は使っていない）

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

行き先を替える例（`OLD` と `NEW` を実際のURLに置き換える）：

```bash
cd ~/Desktop/Claude/chiero_site
OLD='https://old.example/page?'
NEW='https://chiero.jp/new-page/?'
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

# /go/line/ — LINE の登録へ送るページ（今は全経路がチエロ【公式】LINE）

2026-10-01 作成（CEOの依頼）。当初は講座用LINE（UTAGE）の登録経路へ送っていた。2026-11、UTAGE の解約に合わせ、**全ての識別子をチエロ【公式】LINE の出口 `/go/official/<出口>/` へ替えた。** YouTubeの概要欄・固定コメント・QR、Threads、広告の専用LPに置くLINEのURLは、すべて `https://chiero.jp/go/line/?c=<識別子>` にそろえる。仕様の正本は `output/chiero-osaru-funnel-20261001/LAUNCH_ENTRANCES.md` §3。

## 開ける・止める

`go/line/index.html` の頭にある次の1行だけを変える。

```js
var OPEN = false;   // 止める（公開した時の状態）
var OPEN = true;    // 開ける
```

- `false`（止める）：どの識別子で来ても転送しない。「チエロ公式LINEの友だち追加は、こちらです。」の文と、公式LINE（`/go/official/`）・無料公開レッスンの再生リストへのリンクを出す。
- `true`（開ける・今の状態）：`?c=` の値が下の対応表にあれば、その出口へ `location.replace` で移動する。`c` が無い時・表に無い時は `site_top`（→ `/go/official/`）へ移動する。
- JavaScript が動かない時は、`OPEN` の値にかかわらず、止めている時の文とリンクを出す（転送はしない）。

変えた後は、`go/line/index.html` だけをコミットして push する（push の前に autostash なしで `git pull --rebase`）。GitHub Pages の build が終わってから、下の「確かめ方」を行う。GitHub Pages は最大10分ほどキャッシュするため、切り替えが全員に効くまで最大10分ほどかかる。

## 対応表

`go/line/index.html` の下の `ROUTES` に1か所だけ持つ。行き先は全て chiero.jp の `/go/official/<出口>/`（そこから公式LINE の友だち追加へ移る）。

| 識別子 | 行き先 |
|---|---|
| `yt_desc_*`・`yt_pin_common`・`yt_qr_common`（動画の中の QR） | `/go/official/yt/` |
| `threads_common` | `/go/official/th/` |
| `x_bio` | `/go/official/x/` |
| `site_top`（既定）・`ig_bio`・`tt_bio`・`dt05_mail`・`lp_course`・`ad_pos_a_keihi`・`ad_pos_b_gijiroku`・`ad_pos_c_shokuba` | `/go/official/` |

- 識別子を足す時は、`ROUTES` に1行足す。表に無い値で来た人は `site_top`（`/go/official/`）へ送られる。
- 転送先のURLそのものをクエリで受け取る機能はない。表に無い値は、既定の出口へ送る。
- 解約の前の行き先（講座用LINE の mtid）は git の履歴にある。UTAGE を解約した後は使えない。

## 確かめ方

止めている時：

```bash
curl -s 'https://chiero.jp/go/line/?c=test_check' | grep -E 'var OPEN|noindex|受付を止めています'
```

`var OPEN = false;`・`noindex` が出て、止めている時の文（「チエロ公式LINEの友だち追加は、こちらです。」）が本文にあればよい（grep の語は、文に合わせて替える）。ブラウザで `?c=yt_pin_common` を開き、URLが chiero.jp のまま変わらないことを見る。

開けた時：

1. 上の curl で `var OPEN = true;` を確かめる。
2. 転送先まで実際に開く確認は、表に無い値で1回だけ行い、移動先が `/go/official/`（`site_top`）になることを見る。友だち追加までは進まない。
3. 表にある識別子は、ブラウザで開いた時の移動先（`/go/official/<出口>/`）を見る。

## チエロ【公式】LINE への転送（go/official/・2026-10-18 追加）

`https://chiero.jp/go/official/<出口>/` は、チエロ【公式】LINE（@980wypbo・`https://lin.ee/9SqsJTT`）の友だち追加へ転送するページです。公式LINE は UTAGE の外なので、出口の数は UTAGE でなくページの道で数えます。出口ごとにページの道を分け、Cloudflare Web Analytics のページの道ごとの数で、どの出口から来たかを数えます（分析の記録が届くように、0.7秒待ってから移動します）。

| 道 | 出口 |
|---|---|
| `/go/official/` | 共通（出口を分けない時） |
| `/go/official/yt/` | YouTube の概要欄・固定コメント |
| `/go/official/th/` | Threads の案内の返信 |
| `/go/official/x/` | X の案内の返信 |
| `/go/official/note/` | note の記事末 |
| `/go/official/php/` | PHPの脆弱性の発信（note・Threads・X・動画・/ai/php-vulnerability/）2026-10-22 追加 |
| `/go/official/setup/` | AI社員 導入代行（/skills/#setup・公式LINEで「導入代行」と送る）2026-10-23 追加 |
| `/go/official/mon/` | 守り紋（公式LINEで「紋」か「だるま」と送る・3日テスト）2026-10-26 追加 |
| `/go/official/seminar/` | 録画セミナー「AI社員が稼いだ日」の相談の入口（視聴ページの道3）2026-10-24 追加 |
| `/go/official/shindan/` | AI経営室 診断（/keieishitsu/）の結果画面の相談の入口（公式LINEで型の名前を送る）2026-11-17 追加 |
| `/go/official/ig/` | Instagram のプロフィールのリンク（ショートの締め「プロフィールのリンクから」・公式LINEで「シート」と送る）2026-11-18 追加 |
| `/go/official/tt/` | TikTok のプロフィールのリンク（同上）2026-11-18 追加 |
| `/go/official/site/` | 公式サイトの記事（/ai/・/notes/ の19ページ）の「無料のAI実践ガイド10本」のボタン（公式LINEで「シート」と送ると /sheet/ が届き、一番上の /sheet/kit/ から受け取る）。2026-11-23 追加・UTAGE のメール登録 LP から替えた |
| `/go/official/yt/sonae/` | 線③海外の動き（備え）の YouTube の説明欄・固定コメント。2026-11-24 追加（output/list-funnel-20261124） |
| `/go/official/ig/sonae/` | 線③（備え）の Instagram のプロフィールのリンク・コメント。2026-11-24 追加 |
| `/go/official/tt/sonae/` | 線③（備え）の TikTok のプロフィールのリンク。2026-11-24 追加 |
| `/go/official/th/sonae/` | 線③（備え）の Threads の案内の返信。2026-11-24 追加 |
| `/go/official/x/sonae/` | 線③（備え）の X の自己返信。2026-11-24 追加 |
| `/go/official/note/sonae/` | 線③（備え）の note の記事末。2026-11-24 追加 |
| `/go/official/bousai/` | 防災の無料アプリ ボウサイクル の LINE ボタン。2026-11-24 追加 |
| （受け取りのページ）`/sonae/` | 線③（備え）の受け取りのページ「わが家の備え一覧」。転送ページではない。公式LINE の追加直後の文・合言葉「備え」・`/sheet/` の「備え」の札から来る。noindex・sitemap.xml と llms.txt には載せない。2026-11-24 公開 |

出口を足す時は、`go/official/yt/` をフォルダごと複製し、コメントの「出口：」の行だけを替えます。転送先を替える時は、各ページの `noscript` の行と `id="go"` のリンクの2か所を替えます。

無料の4つの一覧ページ：`https://chiero.jp/line-gift/`（公式LINE の挨拶で渡す予定。挨拶の変更は本人の「はい」の後）。どちらも `noindex` で、`sitemap.xml` と `llms.txt` には載せません。

### go/seminar/（録画セミナー「AI社員が稼いだ日」の入口・2026-10-24 追加）
`https://chiero.jp/go/seminar/?c=<出口>` → `https://chiero.jp/skills/?utm_…#seminar`（YouTube の公開動画 `mooLsJ3Wvek` を埋め込んだ節）。当初は UTAGE の視聴ページへ送っていたが、解約に合わせて替えた。公式LINE の本文（キーワード応答「セミナー」＝`?c=line_kw`・ステップ D8＝`?c=line_d8`・一斉配信＝`?c=line_bc<月日>`）には、この URL を書く。`?c=` の値は `utm_content` として渡る。転送先を替える時は、`go/seminar/index.html` の `noscript` の行と `id="go"` のリンクの2か所を同じ URL にする。動画の説明欄の「相談」の入口は `/go/official/seminar/`（公式LINE の友だち追加）。

### go/line/ の行き先の切り替え（2026-10-18 22:2x・本人の「はい」10/18 22:2x）
`go/line/` の対応表のうち、自然流入（`yt_*`・`threads_common`・`x_bio`・`ig_bio`・`tt_bio`・`site_top`）と既定（`yt_qr_common`）の行き先を、上の `/go/official/<出口>/` に切り替えた（YouTube→`yt/`・Threads→`th/`・X→`x/`・ほか→共通）。すでに出回っているリンクも、公式LINE へ向く。
広告（`ad_pos_*`）・講座のLP（`lp_course`）・メール（`dt05_mail`）は、この時は UTAGE の登録経路のままにした。
- 2026-10-19（CEO）：`yt_qr_common`（動画の中の QR）だけを講座用LINE へ戻した。ep09 の語り「QR→登録→無料セミナーの案内が届く」に合わせるため。既定の行き先は `site_top`（→`/go/official/`＝公式LINE）に移した。
- 2026-11（UTAGE の解約に合わせて）：残っていた `ad_pos_*`・`lp_course`・`dt05_mail`・`yt_qr_common` も公式LINE の出口へ替えた（`yt_qr_common`→`/go/official/yt/`・ほか→`/go/official/`）。ep09 の語りとは食い違う（QR の先は公式LINE になる）。

## AI社員一式の購入ページへの転送（go/ai-team/・2026-10-19 追加）
`https://chiero.jp/go/ai-team/` は、note の AI社員一式（https://note.com/kounkt/n/nf6640ae56f4e）へ 0.7秒後に移動するページ。chiero.jp/skills/ の購入ボタン（先頭と「買う意味」の節の2つ）の行き先にして、/skills/ から note へのクリックの数を Cloudflare Web Analytics のページの道で数える。あわせて /skills/ にもビーコンを入れた（それまで入っていなかった）。

## AI経営室 診断を最後までやった回数（keieishitsu/done/・2026-11-18 追加）
`https://chiero.jp/keieishitsu/done/` は、数えるためだけのページ。診断（/keieishitsu/）で10問に答えて結果が出た時に、見えない iframe で1回読み込まれる（転送はしない・答えや型の名前は受け取らない）。Cloudflare Web Analytics のページの道 `/keieishitsu/done/` の表示回数＝診断を最後までやった回数（11/18 から）。目標「診断50件」はこの累計で数える（CEO 2026-11-18）。数え方の正本は `output/shindan-keieishitsu-20261113/MEASURE_1118.md`。
