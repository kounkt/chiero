"""chiero.jp の「言っていること」と「実物」がズレていないか点検する。

「4つとも」と書いて3本しかない、のような事故を機械で捕まえる。
サイトを触ったら必ず流すこと。

★以前は scratchpad に置いていて、一時領域ごと消えた。
  検査道具は検査対象と同じリポジトリに置く。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
llms = (ROOT / "llms.txt").read_text(encoding="utf-8")

ng, ok = [], []


def chk(cond, label, detail=""):
    ok.append(label) if cond else ng.append(f"{label}{(' — ' + detail) if detail else ''}")


# --- 数の一致（見出しが語る数 vs 実際の数）---
biz = re.findall(r'<h3 class="biz-ttl">(.*?)</h3>', html)
note_txt = re.search(r'#business.*?<span class="note">(.*?)</span>', html, re.S)
note_txt = note_txt.group(1) if note_txt else ""
num_claim = re.search(r"([0-9一二三四五六七八九]+)つ", note_txt)
kanji = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5}
if num_claim:
    raw = num_claim.group(1)
    claimed = kanji.get(raw) or (int(raw) if raw.isdigit() else None)
    chk(claimed == len(biz), "事業の数と見出しの記述が一致",
        f"見出し「{note_txt}」 vs 実際{len(biz)}本")

# --- 見せないと決めた事実（消したものが別の面から戻らないか）---
facts = [(re.sub(r"<[^>]+>", "", a), b) for a, b in re.findall(r"<b>(.*?)</b><i>(.*?)</i>", html)]
chk(not any("社員" in b for _, b in facts), "「社員1人」がヒーローに無い", str([b for _, b in facts]))
chk("社員数" not in llms and "一人会社" not in llms, "「社員数/一人会社」がllms.txtに無い")
chk("numberOfEmployees" not in html, "numberOfEmployeesが構造化データに無い")
# 2026-07-16 本人指示: 年齢と法人番号は公開しない
for src, name in ((html, "HTML"), (llms, "llms.txt")):
    chk("1993" not in src, f"生年（1993）が無い（{name}）", "年齢は公開しない方針")
    chk("7290001091210" not in src, f"法人番号が無い（{name}）", "出さない方針")
chk(not re.search(r"birthDate|\d{2}\s*歳(?!以[下上])", html),
    "年齢を逆算できる表記が無い（HTML）", "『◯歳で起業』も設立年から生年が割れる")

# --- プロダクトの並び ---
works = re.findall(r'<h3 class="work-ttl">(.*?)</h3>', html)
chk(bool(works) and works[0] == "出版", "プロダクトの先頭が出版", str(works))
m = re.search(r"## プロダクト\n\n(.*?)\n\n##", llms, re.S)
first = re.search(r"\[(.*?)\]", m.group(1)).group(1) if m else "?"
chk("出版" in first, "llms.txtのプロダクト先頭も出版", first)

# --- 禁止語（Brand OS §2①）---
body = re.sub(r"<!--.*?-->", "", html, flags=re.S)
for w in ["コーチ", "コンサル", "講師", "メンター", "指導", "支援者"]:
    chk(w not in body, f"禁止語「{w}」が無い")

# --- 事実の正確さ ---
for src, name in ((html, "HTML"), (llms, "llms.txt")):
    chk("王様のブランチ" not in src or "出演していません" in src,
        f"『王様のブランチ』を出演と書いていない（{name}）")
    chk("167冊" not in src, f"「167冊」（古い数字）が無い（{name}）")
if "ベストセラー1位" in html:
    chk("歴史・地理の参考図書・白書" in html, "ベストセラー1位にカテゴリ併記(HTML)")
if "ベストセラー1位" in llms:
    chk("歴史・地理の参考図書・白書" in llms, "ベストセラー1位にカテゴリ併記(llms)")

# --- 構造化データ ---
for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
    try:
        d = json.loads(block)
        ok.append(f"構造化データが妥当 — {[i.get('@type') for i in d.get('@graph', [d])]}")
    except Exception as e:
        ng.append(f"構造化データのJSONが壊れている: {e}")

# --- 住所 ---
for src, name in ((html, "HTML"), (llms, "llms.txt")):
    chk("セルクル今泉404号室" in src, f"登記どおりの住所（{name}）")

# --- 沿革（2026-07-16追加）---
hist = re.findall(r'<li><span class="y">(.*?)</span>', html)
if hist:
    chk(len(hist) >= 5, f"沿革が{len(hist)}行ある")
    chk(not re.search(r"年商|月商", re.sub(r"<!--.*?-->|alt=\"[^\"]*\"", "", html, flags=re.S)),
        "沿革・本文に年商/月商の自慢が無い", "数字の自慢は載せない（Brand OS §3）")

# --- アクセス統計ビーコンのゲート（G1〜G4。chiero_analytics/DIRECTIVE.md §2 Step4）---
# ビーコンとプライバシー告知は「同時に成立」していないと約束違反になる。
# 片側だけ直った状態（ビーコンだけ入れて告知を戻す等）を機械で殺す。
CF_TOKEN = "87c0b3b3197c484598ee1d3d073b56df"          # chiero.jp
CF_PAGES = ["index.html", "en/index.html", "privacy/index.html",
            "shindan/index.html", "404.html"]
BEACON = "static.cloudflareinsights.com/beacon.min.js"
# 他社トラッカー・タグマネージャ・広告ピクセル（怪しさゼロと衝突。1つでも入れない）
OTHER_TRACKERS = ["googletagmanager.com", "gtag(", "google-analytics.com",
                  "connect.facebook.net", "fbq(", "static.hotjar.com",
                  "clarity.ms", "matomo", "plausible.io", "segment.com"]
# Cookie同意バナーの実装痕跡（生成り＝怪しさゼロ。不要な計測を入れない限り出ない）
COOKIE_BANNER = ["cookieconsent", "cookie-consent", "cookiebanner",
                 "cookie-banner", "cookiebot", "onetrust", "gdpr-banner"]

pages_txt, any_beacon = {}, False
for rel in CF_PAGES:
    p = ROOT / rel
    if not p.exists():
        ng.append(f"G1 ビーコン対象ページが無い: {rel}")
        continue
    t = p.read_text(encoding="utf-8")
    pages_txt[rel] = t
    any_beacon = any_beacon or (BEACON in t)
    chk(BEACON in t and CF_TOKEN in t, f"G1 {rel} にビーコン（正しいトークン）がある",
        "beacon.min.js と chiero.jp トークンの両方が要る")
    chk(t.count(BEACON) <= 1, f"G1 {rel} のビーコンは1本だけ", "二重計測しない")

for rel, t in pages_txt.items():
    hit = [w for w in OTHER_TRACKERS if w in t]
    chk(not hit, f"G3 {rel} に他社トラッカーが無い", f"検出: {hit}")
    hitb = [w for w in COOKIE_BANNER if w.lower() in t.lower()]
    chk(not hitb, f"G4 {rel} にCookie同意バナーが無い", f"検出: {hitb}")

# G2: ビーコンがあるなら privacy は「更新済み」でなければならない。
priv = pages_txt.get("privacy/index.html", "")
if any_beacon:
    chk("Cloudflare Web Analytics" in priv,
        "G2 ビーコン有 → privacyがCloudflare Web Analyticsを開示している",
        "解析を入れたら事前に告知する約束（8条）")
    for old in ["いずれも使用していません", "アクセス解析ツールの設置"]:
        chk(old not in priv, f"G2 privacyに旧文言（『{old}』）が無い",
            "ビーコンがあるのに『解析なし』と書いてあるのは約束違反")

print("=" * 56)
print(f"✅ {len(ok)} 件")
for x in ok:
    print("   ", x)
print(f"\n{'❌' if ng else '✅'} 未解決 {len(ng)} 件")
for x in ng:
    print("   ", x)
print("=" * 56)
sys.exit(1 if ng else 0)
