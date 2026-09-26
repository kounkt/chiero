#!/usr/bin/env python3
"""bgm.py — 紹介動画のBGMと効果音を、音源ファイルを使わずに数式から合成する。

  python3 bgm.py            → out/bgm.wav（48kHz・ステレオ・16bit）

・既存の楽曲や音素材を使わないので、権利の確認が要らない。
・場面の長さは scenes.json（映像と同じ表）から読む。96BPM・1小節=2.5秒で、場面の切れ目は小節線。
・効果音の時刻は timeline.js の動きに合わせてある（帽子の着地、章の扉、会話の吹き出し、常世の点の減少など）。
  timeline.js の時刻を動かしたら、下の CUES も合わせて直す。
・乱数の種を固定しているので、何度作っても同じ音になる。
"""
import json
import re
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, sosfilt, sosfilt_zi

SR = 48000
HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / 'scenes.json').read_text(encoding='utf-8'))
BPM = CFG['bpm']
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4                     # 16分音符
SC = {}
_acc = 0.0
for _s in CFG['scenes']:
    SC[_s['id']] = (_acc, _acc + _s['bars'] * BAR)
    _acc += _s['bars'] * BAR
DURATION = _acc
N = int(round(DURATION * SR))
BARS = int(round(DURATION / BAR))
rng = np.random.default_rng(20201201)

# ---------------------------------------------------------------- 音名
_NAMES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
          'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    n, o = re.fullmatch(r'([A-G][#b]?)(-?\d)', name).groups()
    return 440.0 * 2 ** ((12 * (int(o) + 1) + _NAMES[n] - 69) / 12)


# ---------------------------------------------------------------- 和音（ハ長調）
# pad: 持続音の声部 / arp: 分散和音の音 / bass: 根音
CHORDS = {
    'Cadd9':    dict(bass='C2', pad=['C3', 'G3', 'D4', 'E4'], arp=['C4', 'E4', 'G4', 'D5']),
    'Fmaj7':    dict(bass='F2', pad=['F3', 'A3', 'C4', 'E4'], arp=['F4', 'A4', 'C5', 'E5']),
    'G6':       dict(bass='G2', pad=['G3', 'B3', 'D4', 'E4'], arp=['G4', 'B4', 'D5', 'E5']),
    'Em7':      dict(bass='E2', pad=['E3', 'G3', 'B3', 'D4'], arp=['E4', 'G4', 'B4', 'D5']),
    'Am7':      dict(bass='A2', pad=['E3', 'G3', 'A3', 'C4'], arp=['A4', 'C5', 'E5', 'G5']),
    'Am9':      dict(bass='A2', pad=['A3', 'C4', 'G4', 'B4'], arp=['A4', 'C5', 'E5', 'B5']),
    'Fmaj7#11': dict(bass='F2', pad=['F3', 'A3', 'E4', 'B4'], arp=['F4', 'A4', 'E5', 'B5']),
    'Dm9':      dict(bass='D2', pad=['F3', 'A3', 'C4', 'E4'], arp=['D4', 'F4', 'A4', 'E5']),
    'G7sus4':   dict(bass='G2', pad=['G3', 'C4', 'D4', 'F4'], arp=['G4', 'C5', 'D5', 'F5']),
}
LOOP = ['Fmaj7', 'G6', 'Em7', 'Am7']
# 1小節ずつの和音（場面: 1-2 開幕 / 3-20 本編 / 21-25 常世 / 26-38 本編 / 39-41 理念 / 42-44 締め）
PROG = (['Cadd9', 'Cadd9'] + (LOOP * 5)[:18] + ['Am9', 'Fmaj7#11', 'Dm9', 'Em7', 'G7sus4']
        + (LOOP * 4)[:13] + ['G6', 'Em7', 'Am9'] + ['Fmaj7', 'G6', 'Cadd9'])
assert len(PROG) == BARS == 44, (len(PROG), BARS)


def section(bar):
    """0始まりの小節番号 → 編成"""
    b = bar + 1
    if b <= 2:
        return 'intro'
    if b <= 7:
        return 'light'
    if b <= 20:
        return 'full'
    if b <= 25:
        return 'tokoyo'
    if b <= 38:
        return 'full2'
    if b <= 41:
        return 'calm'
    return 'outro'


# ---------------------------------------------------------------- 道具
def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def tarr(n):
    return np.arange(n) / SR


def fade_in(y, sec):
    k = min(len(y), max(1, int(sec * SR)))
    y[:k] *= np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    return y


def place(bus, t, y, gain=1.0, pan=0.5):
    """モノラル y を時刻 t（秒）に置く。pan: 0=左 1=右（等パワー）"""
    i = int(round(t * SR))
    if i >= len(bus) or i + len(y) <= 0:
        return
    if i < 0:
        y, i = y[-i:], 0
    y = y[:len(bus) - i]
    bus[i:i + len(y), 0] += y * gain * np.cos(pan * np.pi / 2)
    bus[i:i + len(y), 1] += y * gain * np.sin(pan * np.pi / 2)


def place2(bus, t, y, gain=1.0):
    """ステレオ y (n,2) を置く"""
    i = int(round(t * SR))
    if i >= len(bus):
        return
    y = y[:len(bus) - i]
    bus[i:i + len(y)] += y * gain


def saw(freq, n, phase=0.0):
    """帯域制限のこぎり波（PolyBLEP）"""
    dt = freq / SR
    ph = (phase + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def noise(n):
    return rng.standard_normal(n)


# ---------------------------------------------------------------- 楽器
def pad_note(freq, dur, cutoff=1900, rel=1.6, att=0.5, detune=8):
    n = int((dur + rel) * SR)
    t = tarr(n)
    out = np.zeros((n, 2))
    for cents, pan in ((-detune, 0.15), (0, 0.5), (detune, 0.85)):
        s = saw(freq * 2 ** (cents / 1200), n, rng.random())
        out[:, 0] += s * np.cos(pan * np.pi / 2)
        out[:, 1] += s * np.sin(pan * np.pi / 2)
    env = np.minimum(1.0, t / att) ** 2
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) * 5.0 / rel))
    out *= env[:, None]
    return lp(out, cutoff, 2) * 0.22


def pluck(freq, dur=1.1, bright=1.0):
    """はじく音（倍音ほど早く消える加算合成）"""
    n = int(dur * SR)
    t = tarr(n)
    y = np.zeros(n)
    for k in range(1, 12):
        fk = freq * k
        if fk > 15000:
            break
        amp = (1 / k ** 1.3) * (1.0 if k == 1 else bright)
        y += amp * np.sin(2 * np.pi * fk * t) * np.exp(-(2.2 + 1.3 * k) * t)
    return fade_in(y, 0.003) * 0.5


def bell(freq, dur=3.2, bright=1.0):
    """鉄琴とチェレスタの間くらいの鐘"""
    n = int(dur * SR)
    t = tarr(n)
    y = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.1), (2, .45, 1.7), (3, .22, 2.6), (4.16, .16, 3.6), (5.43, .1, 4.8), (6.79, .07, 6.5)):
        if freq * ratio > 16000:
            continue
        y += amp * (bright if ratio > 1 else 1) * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-dec * t)
    return fade_in(y, 0.002) * 0.4


def marimba(freq, dur=0.9):
    n = int(dur * SR)
    t = tarr(n)
    y = (np.sin(2 * np.pi * freq * t) * np.exp(-5.5 * t)
         + .32 * np.sin(2 * np.pi * freq * 3.93 * t) * np.exp(-19 * t)
         + .10 * np.sin(2 * np.pi * freq * 9.2 * t) * np.exp(-34 * t))
    return fade_in(y, 0.002) * 0.5


def bass_note(freq, dur):
    rel = 0.07
    n = int((dur + rel) * SR)
    t = tarr(n)
    y = np.sin(2 * np.pi * freq * t) + .22 * np.sin(4 * np.pi * freq * t) + .08 * lp(saw(freq, n), 700, 2)
    env = np.minimum(1, t / 0.006) * (0.72 + 0.28 * np.exp(-t * 7))
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4)))
    return np.tanh(1.3 * y * env) * 0.55


def kick(vel=1.0):
    n = int(0.5 * SR)
    t = tarr(n)
    f = 47 + 95 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.0)
    click = hp(noise(n), 3000) * np.exp(-t * 400) * 0.25
    y = np.tanh(1.6 * (body + click)) / np.tanh(1.6)
    return y * vel * 0.9


def clap(vel=1.0):
    n = int(0.45 * SR)
    t = tarr(n)
    e = sum(np.where(t >= d, np.exp(-(t - d) * 180), 0) for d in (0, .009, .019)) + 0.55 * np.where(t >= .026, np.exp(-(t - .026) * 16), 0)
    return bp(noise(n), 900, 3200) * e * vel * 0.32


def hat(vel=1.0, open_=False):
    n = int((0.3 if open_ else 0.09) * SR)
    t = tarr(n)
    return hp(noise(n), 7500, 2) * np.exp(-t * (12 if open_ else 60)) * vel * 0.24


def shaker(vel=1.0):
    n = int(0.11 * SR)
    t = tarr(n)
    e = np.minimum(1, t / 0.012) * np.exp(-t * 38)
    return bp(noise(n), 4500, 10000) * e * vel * 0.13


# ---------------------------------------------------------------- 効果音
def sweep_noise(dur, f0, f1, width=1.0, curve=1.0):
    """帯域の中心が f0→f1 へ動くノイズ（小さなブロックごとに係数を替え、状態は引き継ぐ）"""
    n = int(dur * SR)
    x = noise(n)
    y = np.zeros(n)
    blk = 256
    zi = None
    for i in range(0, n, blk):
        p = (i / n) ** curve
        fc = f0 * (f1 / f0) ** p
        lo, hi = max(40, fc / (1 + width)), min(SR / 2 - 100, fc * (1 + width))
        sos = butter(2, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        y[i:i + blk], zi = sosfilt(sos, x[i:i + blk], zi=zi)
    return y


def whoosh(dur=0.8, f0=300, f1=4500, peak=0.55):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    env = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.6)
    y = sweep_noise(dur, f0, f1, 0.8) * env
    return y / (np.abs(y).max() + 1e-9) * 0.6


def riser(dur=1.15):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    y = sweep_noise(dur, 250, 7000, 0.6, curve=1.6) * t ** 2.2
    y = y / (np.abs(y).max() + 1e-9)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2.2 * t)) / SR) * t ** 3 * 0.35
    return (y * 0.6 + tone) * 0.8


def impact():
    n = int(2.0 * SR)
    t = tarr(n)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.6)
    hiss = lp(noise(n), 5000) * np.exp(-t * 7) * 0.35
    return np.tanh(1.4 * (boom + hiss)) * 0.8


def tok(freq=1150):
    n = int(0.25 * SR)
    t = tarr(n)
    y = (np.sin(2 * np.pi * freq * t) + .5 * np.sin(2 * np.pi * freq * 1.52 * t)) * np.exp(-t * 48)
    y += hp(noise(n), 2500) * np.exp(-t * 500) * 0.3
    return fade_in(y, 0.0008) * 0.45


def pop(f0=260, f1=720):
    n = int(0.16 * SR)
    t = tarr(n)
    f = f1 + (f0 - f1) * np.exp(-t * 55)
    return fade_in(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26), 0.001) * 0.5


def blip(f0, f1):
    """吹き出しが出る音"""
    n = int(0.22 * SR)
    t = tarr(n)
    f = np.where(t < 0.045, f0 + (f1 - f0) * (t / 0.045), f1)
    y = (np.sin(2 * np.pi * np.cumsum(f) / SR) + .18 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 20)
    return fade_in(y, 0.002) * 0.3


def ping(freq, dur=4.0):
    """一点だけが残る音：ほぼ純音で、ゆっくり消える"""
    n = int(dur * SR)
    t = tarr(n)
    y = np.sin(2 * np.pi * freq * t + 0.003 * np.sin(2 * np.pi * 5 * t) * freq / 5) * np.exp(-t * 0.9)
    return fade_in(y, 0.004) * 0.3


# ---------------------------------------------------------------- バス
def bus():
    return np.zeros((N + int(4 * SR), 2))


DRUMS, BASS, PAD, DRONE, ARP, BELL, SFX = (bus() for _ in range(7))
KICKS = []


def bar_t(b):
    return b * BAR


# ---- 和音と伴奏 ----
for b, name in enumerate(PROG):
    ch = CHORDS[name]
    sec = section(b)
    t0 = bar_t(b)
    nxt = section(b + 1) if b + 1 < BARS else None

    # 持続音（常世は暗く、締めと開幕は柔らかく）
    cutoff = {'intro': 1500, 'light': 2000, 'full': 2300, 'tokoyo': 1100, 'full2': 2400, 'calm': 1800, 'outro': 1700}[sec]
    vol = {'intro': 0.7, 'light': 0.75, 'full': 0.7, 'tokoyo': 0.8, 'full2': 0.7, 'calm': 0.95, 'outro': 0.9}[sec]
    dur = BAR
    if name == 'G7sus4':
        # 後半2拍で sus4 → 3度へ解決（F→B）
        for f in ch['pad']:
            f2 = 'B3' if f == 'C4' else f
            place2(PAD, t0, pad_note(hz(f), BAR / 2, cutoff), vol)
            place2(PAD, t0 + BAR / 2, pad_note(hz(f2), BAR / 2, cutoff, att=0.2), vol)
    else:
        if b == BARS - 1:
            dur = BAR + 0.6     # 最後の和音は少し長く鳴らしてから消える
        for f in ch['pad']:
            place2(PAD, t0, pad_note(hz(f), dur, cutoff, rel=2.2 if b == BARS - 1 else 1.6), vol)
    if sec == 'tokoyo':
        # 低い持続音（深い水の底）
        place2(DRONE, t0, pad_note(hz(ch['bass']), BAR, 420, att=0.8), 0.9)

    # 低音
    if sec in ('light', 'full', 'full2'):
        pattern = [(0, 3), (3, 1), (4, 2), (6, 2)] if sec == 'light' else [(0, 3), (3, 1), (4, 2), (6, 1), (7, 1)]
        for step8, len8 in pattern:
            f = hz(ch['bass'])
            if sec != 'light' and step8 == 7:
                f *= 2          # 小節の終わりだけ1オクターブ上で弾む
            place(BASS, t0 + step8 * BEAT / 2, bass_note(f, len8 * BEAT / 2 * 0.92), 1.0)
    elif sec in ('calm', 'outro'):
        place(BASS, t0, bass_note(hz(ch['bass']), BAR * 0.95), 0.8)

    # 分散和音（8分）
    if sec in ('light', 'full', 'full2', 'calm'):
        order = [0, 2, 1, 3, 2, 1, 3, 2] if sec != 'full2' else [0, 2, 3, 1, 2, 3, 1, 2]
        for k, idx in enumerate(order):
            if sec == 'calm' and k % 2:
                continue       # 理念の場面は4分でゆっくり
            f = hz(ch['arp'][idx])
            vel = (0.9 if k % 2 == 0 else 0.62) * (0.8 if sec == 'light' else 1.0)
            place(ARP, t0 + k * BEAT / 2, pluck(f, 1.3), vel, pan=0.32 if k % 2 == 0 else 0.68)
    elif sec == 'intro' and b == 1:
        for k, idx in enumerate([0, 1, 2, 3]):
            place(ARP, t0 + BAR / 2 + k * BEAT / 2, pluck(hz(ch['arp'][idx]), 1.4, 0.8), 0.45, pan=0.3 + 0.13 * k)

    # リズム
    if sec in ('light', 'full', 'full2'):
        last_bar_before_break = (nxt in ('tokoyo', 'calm'))
        for st in range(16):
            tt = t0 + st * STEP
            if last_bar_before_break and st >= 12:
                break          # 次の場面の前で一拍抜く
            if st in (0, 8) or (sec != 'light' and st == 11 and b % 2 == 1):
                v = 1.0 if st != 11 else 0.55
                place(DRUMS, tt, kick(v), 1.0)
                KICKS.append((tt, v))
            if sec != 'light' and st in (4, 12) and b + 1 >= 8:
                place(DRUMS, tt, clap(), 0.85, pan=0.5)
            if st % 2 == 0:
                v = 0.55 if st % 4 == 0 else 1.0
                place(DRUMS, tt + (0.012 if st % 4 == 2 else 0), hat(v), 0.9, pan=0.62)
            if sec != 'light' and b + 1 >= 11:
                sw = 0.018 if st % 2 else 0
                place(DRUMS, tt + sw, shaker(0.6 + 0.4 * (st % 2)), 1.0, pan=0.36)
        if sec != 'light' and b % 4 == 3 and not last_bar_before_break:
            place(DRUMS, t0 + 14 * STEP, hat(0.8, open_=True), 0.8, pan=0.62)
    elif sec == 'calm':
        place(DRUMS, t0, kick(0.45), 1.0)
        KICKS.append((t0, 0.45))
    elif sec == 'outro' and b == BARS - 3:
        place(DRUMS, t0, kick(0.6), 1.0)
        KICKS.append((t0, 0.6))


# ---- 旋律・鐘・効果音（timeline.js の時刻に合わせる） ----
def run(t, notes, gap=0.06, gain=0.5, inst=bell):
    for k, nm in enumerate(notes):
        place(BELL, t + k * gap, inst(hz(nm)), gain, pan=0.3 + 0.4 * k / max(1, len(notes) - 1))


o = SC['opening'][0]
place(SFX, o + 0.08, whoosh(0.62, 3500, 600, peak=0.8), 0.25, pan=0.5)          # 帽子が落ちる
place(SFX, o + 0.70, tok(980), 0.9)                                             # 着地
place(SFX, o + 1.14, tok(1250), 0.45)                                           # 小さく跳ねて止まる
place(BELL, o + 0.70, bell(hz('G5')), 0.45)
run(o + 0.95, ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'], gap=0.06, gain=0.32)        # 6文字が順に立つ
place(SFX, o + 3.95, whoosh(1.05, 500, 3800), 0.55, pan=0.35)                     # ロゴがヘッダーへ

s = SC['statement'][0]
place(SFX, s + 2.83, pop(240, 700), 0.55)                                        # ？が！に返る
place(BELL, s + 2.85, bell(hz('E6')), 0.3)

for t_in, t_out in ((SC['business'][1] - 0.65, SC['media'][0] + 1.15),          # 章の扉 01
                    (SC['apps'][1] - 0.65, SC['advisory'][0] + 1.15)):           # 章の扉 03
    place(SFX, t_in, whoosh(0.8, 280, 5200), 1.0, pan=0.7)
    place(SFX, t_out, whoosh(0.8, 5200, 380), 0.8, pan=0.3)
place(SFX, SC['books'][1] - 0.65, whoosh(0.8, 280, 5200), 1.0, pan=0.7)         # 章の扉 02

m0 = SC['media'][0]
place(SFX, m0 + 2.75, tok(1500), 0.7)                                           # 東京のマスが赤くなる
place(SFX, m0 + 3.15, whoosh(0.6, 700, 3000, peak=0.35), 0.4)                   # 面接の画面が立ち上がる
for k, dt in enumerate((3.95, 4.85, 5.95, 6.95)):                                # 吹き出し
    place(SFX, m0 + dt, blip(*((hz('C6'), hz('E6')) if k % 2 == 0 else (hz('E6'), hz('G6')))), 1.3, pan=0.4 if k % 2 == 0 else 0.6)

# 常世：点が減るたびに鐘が一音ずつ下がり、一点になったところで細い純音だけが残る
k0 = SC['tokoyo'][0]
for dt, nm in ((1.6, 'E5'), (4.1, 'B4'), (5.6, 'C5')):
    place(BELL, k0 + dt, bell(hz(nm), 4.0, 0.6), 0.35, pan=0.6)
for k, (dt, nm) in enumerate(zip((7.0, 7.25, 7.5, 7.75, 8.0, 8.25), ('E6', 'C6', 'A5', 'G5', 'E5', 'B4'))):
    place(BELL, k0 + dt, bell(hz(nm), 3.0, 0.7), 0.26, pan=0.75 - 0.08 * k)
place(BELL, k0 + 9.0, ping(hz('E6'), 4.5), 0.55, pan=0.6)
bloom = SC['tokoyo'][1] - 1.15
place2(SFX, bloom, np.stack([riser(1.15)] * 2, 1) * np.array([0.9, 1.0]), 0.65)  # 一点が白く広がる
place(SFX, SC['tokoyo'][1], impact(), 0.85)                                       # 白い紙へ
place(SFX, SC['tokoyo'][1], whoosh(0.5, 6000, 1200, peak=0.1), 0.25)

# アプリの場面：こはくが歩く間だけ、木琴の短い旋律
a0 = SC['apps'][0]
MEL = [('C6', 0), ('A5', 1), ('G5', 2), ('A5', 3), ('C6', 4), ('D6', 6),
       ('B5', 8), ('D6', 9), ('G5', 10), ('B5', 12), ('D6', 14)]
for nm, st8 in MEL:
    place(BELL, a0 + (3 + st8) * BEAT / 2, marimba(hz(nm)), 0.6, pan=0.62)   # 2拍目の裏から（こはくが歩き出す頃）

# 締め：帽子がもう一度跳ね、開幕と同じ音列で終わる
c0 = SC['closing'][0]
place(SFX, c0 + 0.85, pop(420, 900), 0.3)
place(SFX, c0 + 1.49, tok(980), 0.8)
place(BELL, c0 + 1.49, bell(hz('G5')), 0.4)
run(c0 + 1.7, ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'], gap=0.07, gain=0.28)
place(BELL, bar_t(BARS - 1), bell(hz('E6'), 4.5), 0.3, pan=0.35)
place(BELL, bar_t(BARS - 1) + 0.08, bell(hz('G6'), 4.5), 0.26, pan=0.5)
place(BELL, bar_t(BARS - 1) + 0.16, bell(hz('C7'), 4.5), 0.22, pan=0.65)


# ---------------------------------------------------------------- 混ぜる
def make_ir(rt60=2.3, pre=0.018):
    n = int((rt60 + pre) * SR)
    t = tarr(n)
    ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * t / rt60)[:, None]
    ir[:int(pre * SR)] = 0
    dark = lp(ir, 2600, 1)
    w = np.clip(t / 0.7, 0, 1)[:, None]
    ir = hp(ir * (1 - w) + dark * w, 150)
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def reverb(x, ir):
    return np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in (0, 1)], axis=1)


def high_shelf(x, fc, gain_db, q=0.707):
    """RBJ のシェルフ型イコライザー"""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * fc / SR
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    b0 = A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al)
    b1 = -2 * A * ((A - 1) + (A + 1) * c)
    b2 = A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)
    a0 = (A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al
    a1 = 2 * ((A - 1) - (A + 1) * c)
    a2 = (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al
    return lfilter(np.array([b0, b1, b2]) / a0, np.array([a0, a1, a2]) / a0, x, axis=0)


def pingpong(x, d=3 * STEP, fb=0.3, n=4):
    y = x.copy()
    src = lp(x, 3500)
    for k in range(1, n + 1):
        i = int(round(k * d * SR))
        g = fb ** k
        ch = k % 2          # 左右交互
        y[i:, ch] += src[:-i, 0 if ch else 1] * g if i < len(x) else 0
    return y


# キックに合わせて持続音と低音を少し沈める（ポンプ）
duck = np.ones(len(PAD))
L = int(0.35 * SR)
tt = tarr(L)
for t, v in KICKS:
    i = int(round(t * SR))
    j = min(len(duck), i + L)
    duck[i:j] *= (1 - 0.38 * v * np.exp(-tt / 0.11))[:j - i]
PAD = hp(PAD, 220, 2) * duck[:, None]     # 低い帯域は低音に任せて、濁りを避ける
ARP *= (0.5 + 0.5 * duck)[:, None]
BASS *= (0.35 + 0.65 * duck)[:, None]

ARP = pingpong(ARP)
IR = make_ir()
room = reverb(PAD * 0.35 + DRONE * 0.3 + ARP * 0.5 + BELL * 0.7 + SFX * 0.25 + DRUMS * 0.08, IR)

mix = (DRUMS * 0.9 + BASS * 0.8 + PAD * 0.5 + DRONE * 0.7 + ARP * 0.85 + BELL * 0.8 + SFX * 0.9 + room * 0.5)
mix = hp(mix, 28, 2)
mix = high_shelf(mix, 3500, 4.0)          # 少しだけ明るく（鈴・はじく音・ハイハットの輪郭）
mix = mix[:N]

# ラウドネスを -16 LUFS 付近へ（K特性の近似で測る）
def k_weight(x):
    b, a = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    y = lfilter(b, a, x, axis=0)
    b, a = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return lfilter(b, a, y, axis=0)


def lufs(x):
    y = k_weight(x)
    blk = int(0.4 * SR)
    hop = blk // 4
    ms = np.array([(y[i:i + blk] ** 2).mean(axis=0).sum() for i in range(0, len(y) - blk, hop)])
    lk = -0.691 + 10 * np.log10(ms + 1e-12)
    gated = ms[lk > -70]
    rel = -0.691 + 10 * np.log10(gated.mean()) - 10
    gated = ms[(lk > -70) & (lk > rel)]
    return -0.691 + 10 * np.log10(gated.mean())


TARGET = -16.0
mix *= 10 ** ((TARGET - lufs(mix)) / 20)

# ピークを -1 dBFS に抑える（先読みつきの簡単なリミッター）
ceil = 10 ** (-1.2 / 20)
peak = np.abs(mix).max(axis=1)
g = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
look = int(0.004 * SR)
from scipy.ndimage import minimum_filter1d  # noqa: E402
g = minimum_filter1d(g, size=2 * look + 1, mode='nearest')
rel_a = np.exp(-1 / (0.08 * SR))
gs = lfilter([1 - rel_a], [1, -rel_a], 1 - g)            # 戻りをなめらかに
g = 1 - np.maximum(1 - g, gs)
mix *= g[:, None]
mix = np.clip(mix, -ceil, ceil)

# 最初と最後
mix[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
fo = int(1.2 * SR)
mix[-fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]

out = HERE / 'out'
out.mkdir(exist_ok=True)
wavfile.write(out / 'bgm.wav', SR, (mix * 32767).astype(np.int16))
print(f'bgm.wav  {DURATION:.2f}s  loudness {lufs(mix):.1f} LUFS  peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS')
for name, b in (('drums', DRUMS), ('bass', BASS), ('pad', PAD), ('drone', DRONE), ('arp', ARP), ('bell', BELL), ('sfx', SFX)):
    r = np.sqrt((b[:N] ** 2).mean())
    print(f'  {name:6s} rms {20 * np.log10(r + 1e-12):6.1f} dB')
