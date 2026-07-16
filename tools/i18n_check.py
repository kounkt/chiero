#!/usr/bin/env python3
"""日本語版と英語版の構造の一致を検査する。

翻訳の質は検査しない。検査するのは「片側だけ直された」状態。
事業を4本に増やして英語版が3本のまま、沿革に1行足して英語版が古いまま——
こういう腐り方は目視では絶対に見つからない。ここで落とす。

  python3 tools/i18n_check.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JA = (ROOT / "index.html").read_text(encoding="utf-8")
EN = (ROOT / "en" / "index.html").read_text(encoding="utf-8")

fails: list[str] = []
oks: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (oks if cond else fails).append(f"{name}{'' if cond else ' — ' + detail}")


# ── 数が一致すべきもの ───────────────────────────────────────────
def count(html: str, pat: str) -> int:
    return len(re.findall(pat, html))


for label, pat in [
    ("事業の本数", r'<span class="biz-no">'),
    ("プロダクトの数", r'<span class="work-cat">'),
    ("沿革の行数", r'<li><span class="y">'),
    ("事実の帯の項目数", r'<div><b>'),
    ("出演の枠数", r'<a class="tape"'),
    ("会社概要の行数", r"<dt>"),
    ("書影の枚数", r'src="/?covers/'),
]:
    j, e = count(JA, pat), count(EN, pat)
    check(f"{label}が一致 ({j})", j == e, f"JA={j} / EN={e}")


# ── 数値そのものが一致すべきもの ─────────────────────────────────
# 「200冊超 → 200+」のように単位は訳すが、数字を訳し忘れると事実が食い違う
def facts(html: str) -> list[str]:
    body = re.search(r'<div class="facts[^"]*">(.*?)\n\s*</div>', html, re.S)
    return re.findall(r"<b>([^<]*)", body.group(1)) if body else []


ja_f, en_f = facts(JA), facts(EN)
check(
    "事実の帯の数値が対応",
    [re.sub(r"\D", "", x) for x in ja_f] == ["200", "40", "10"]
    and [re.sub(r"\D", "", x) for x in en_f] == ["200", "400", "1"],
    f"JA={ja_f} / EN={en_f}（40万人→400K・10億回→1B+ の対応が崩れています）",
)

# 沿革の年（「現在」/「Now」以外は数字が完全一致すべき）
ja_y = re.findall(r'<span class="y">([^<]+)</span>', JA)
en_y = re.findall(r'<span class="y">([^<]+)</span>', EN)
check(
    "沿革の年が一致",
    [y for y in ja_y if y.isdigit()] == [y for y in en_y if y.isdigit()],
    f"JA={ja_y} / EN={en_y}",
)

# 著書数：両方が同じ数を名乗っているか（本文中の 200 / 200+）
check(
    "著書数が両版とも200",
    "200冊" in JA and re.search(r"\b200\+?\b", EN) is not None,
    "片側の冊数が更新されていません",
)


# ── hreflang の相互宣言 ──────────────────────────────────────────
for label, html, need in [
    ("JA", JA, ['hreflang="ja" href="https://chiero.jp/"', 'hreflang="en" href="https://chiero.jp/en/"']),
    ("EN", EN, ['hreflang="ja" href="https://chiero.jp/"', 'hreflang="en" href="https://chiero.jp/en/"']),
]:
    check(f"{label}側が両言語のhreflangを宣言", all(n in html for n in need), "片側だけの宣言は無効です")

check("x-default が日本語を指す", 'hreflang="x-default" href="https://chiero.jp/"' in JA and 'hreflang="x-default" href="https://chiero.jp/"' in EN)
check("EN の canonical が /en/", '<link rel="canonical" href="https://chiero.jp/en/">' in EN)
check("JA の canonical が /", '<link rel="canonical" href="https://chiero.jp/">' in JA)
check("双方向のリンクがある", 'href="/en/"' in JA and 'href="/"' in EN)
check("sitemap に /en/ がある", "https://chiero.jp/en/" in (ROOT / "sitemap.xml").read_text(encoding="utf-8"))


# ── 英語版が背負ってはいけないもの ───────────────────────────────
# 顧問は日本語のみ。英語版から price/特商法へ誘導すると、
# 読めない契約に外国語話者を連れて行くことになる
check("EN が work.chiero.jp へ誘導していない", "work.chiero.jp" not in EN, "顧問は日本語のみの取り扱いです")
EN_TEXT = re.sub(r"<style>.*?</style>", "", EN, flags=re.S)
check("EN に価格の記載がない", not re.search(r"[¥$]\s?\d|\d{3},\d{3}|\bJPY\b", EN_TEXT), "価格は日本語の面だけに置きます")

# 年齢の逆算（本人の指示：年齢は公開していない）
for label, html in [("JA", JA), ("EN", EN)]:
    check(f"{label} に生年・年齢がない", not re.search(r"birthDate|1993|\bage\b|\d{2}\s*歳(?!以[下上])", html))
    check(f"{label} に法人番号がない", "法人番号" not in html and "Corporate Number" not in html)

# 日本語話者以外が踏むと壊れるリンク（日本語しかないものは明示する）
ja_only_links = re.findall(r'href="(https://(?:note\.com|freedom-type|kounkt\.github\.io|www\.amazon\.co\.jp)[^"]*)"', EN)
check(
    "EN の日本語コンテンツへのリンクに Japanese の断りがある",
    EN.count("Japanese") >= 5,
    f"日本語しかないリンクが{len(ja_only_links)}本あります。読者は英語話者です",
)

# Brand OS §2① 禁止語（英語でも同じ）
BANNED_EN = r"\b(coach|coaching|consultant|consulting|mentor|instructor|guru)\b"
hit = re.findall(BANNED_EN, EN, re.I)
check("EN に禁止語がない（Brand OS §2①）", not hit, f"検出: {set(hit)}")

# 断定的判断（消費者契約法4条の考え方は英語面でも守る）
check(
    "EN に断定的な成果の約束がない",
    not re.search(r"\b(guarantee[ds]?|guaranteed results|will (?:definitely|surely) (?:earn|grow|succeed))\b", EN, re.I),
)

# ── 表示の骨格（DESIGN.md）─────────────────────────────────────
check("EN が同じトークンを使っている", "--red:#E60012" in EN and "--ink:#0E0E0E" in EN)
check("EN が二書体のみ", EN.count("@import") == 0 and "fonts.googleapis" not in EN)
check("EN が赤を一点で使っている（h1 の em）", '<h1>' in EN and "h1 em{font-style:normal;color:var(--red)}" in EN)
check("EN の lang 属性が en", '<html lang="en">' in EN)
check("JA の lang 属性が ja", '<html lang="ja">' in JA)


# ── モバイルの骨格 ──────────────────────────────────────────────
# 読者は Instagram 経由＝ほぼスマホ。880px以下では .nav-links が消えるので、
# 言語切替が nav の中にあると英語版へ辿り着けなくなる。位置を検査で固定する。
for label, html in [("JA", JA), ("EN", EN)]:
    nav_end = html.find("</nav>")
    lang_at = html.find('class="lang"')
    check(f"{label} の言語切替が nav の外にある", lang_at > nav_end > 0,
          "nav の中に置くと 880px 以下で切替ごと消えます")
    check(f"{label} が 880px でナビを畳む", ".nav-links{display:none}" in html)
    check(f"{label} が 430px の詰めルールを持つ", "@media(max-width:430px)" in html)
    check(f"{label} のロゴが折り返さない", "white-space:nowrap" in html.split(".logo{")[1].split("}")[0])

# ── 出力 ────────────────────────────────────────────────────────
print(f"\n  \033[2m{len(oks)} 件通過\033[0m")
for o in oks:
    print(f"  \033[32m✓\033[0m \033[2m{o}\033[0m")
if fails:
    print(f"\n  \033[31m{len(fails)} 件失敗\033[0m")
    for f in fails:
        print(f"  \033[31m✗ {f}\033[0m")
    print()
    sys.exit(1)
print(f"\n  \033[32mJP/EN の構造は一致しています\033[0m\n")
