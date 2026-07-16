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

print("=" * 56)
print(f"✅ {len(ok)} 件")
for x in ok:
    print("   ", x)
print(f"\n{'❌' if ng else '✅'} 未解決 {len(ng)} 件")
for x in ng:
    print("   ", x)
print("=" * 56)
sys.exit(1 if ng else 0)
