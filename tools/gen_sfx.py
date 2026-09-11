#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""玲珑消 · tools/gen_sfx.py — 程序化合成全部音效（纯标准库，零第三方依赖、零版权）

    python tools/gen_sfx.py

合成设计（依据公开的钟体分音表与混响常量，见 README「音效设计」）：
  · 金属体 = 敲击瞬态（3.5–6 kHz 带通噪声，约 2.5 ms）+ 非谐分音 + 每个分音 ±2 音分拍频
  · 连锁音在 A 五声音阶上逐层升高，直接生成 7 个音高文件（不用 playbackRate 变速）
  · 共享一套 Freeverb 式混响（8 梳状 + 4 全通），按音效类型给不同湿/干比
  · 各类型峰值电平分开：消除 −6 dBFS / UI −12 dBFS / 无效 −14 dBFS / 结算 −3 dBFS
  · 4 kHz 以上分音额外压 10–15 dB（避免「响但刺耳」），≥0.45×SR 的分音直接丢弃（抗混叠）
"""

import math
import os
import struct
import wave

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')

class Rng:
    """素材生成专用的确定性随机源（xorshift32）。

    这里刻意不使用 random 模块，也不使用密码学随机源：音效素材必须**可复现**——
    同样的脚本与参数重跑应当得到逐字节相同的 WAV，否则仓库会不断产生无意义的二进制差异。
    噪声只用于打击瞬态、碎屑与气息，统计特性与随机源实现无关。
    """

    def __init__(self, seed):
        self.s = (seed & 0xFFFFFFFF) or 0x9E3779B9

    def random(self):
        s = self.s
        s ^= (s << 13) & 0xFFFFFFFF
        s ^= s >> 17
        s ^= (s << 5) & 0xFFFFFFFF
        self.s = s & 0xFFFFFFFF
        return self.s / 4294967296.0

    def uniform(self, a, b):
        return a + (b - a) * self.random()


rng = Rng(20240501)


# ------------------------------------------------------------------ 工具

def zeros(dur):
    return [0.0] * int(SR * dur)


def db(x):
    """分贝 → 线性倍数"""
    return 10.0 ** (x / 20.0)


def mix_at(dst, src, at=0.0, gain=1.0):
    start = int(at * SR)
    need = start + len(src) - len(dst)
    if need > 0:
        dst.extend([0.0] * need)
    for i, v in enumerate(src):
        dst[start + i] += v * gain
    return dst


def fade(sig, in_ms=1.5, out_ms=35.0):
    n = len(sig)
    a = max(1, int(SR * in_ms / 1000.0))
    b = max(1, int(SR * out_ms / 1000.0))
    for i in range(min(a, n)):
        sig[i] *= i / a
    for i in range(min(b, n)):
        sig[n - 1 - i] *= i / b
    return sig


def exp_env(n, tau):
    k = math.exp(-1.0 / (tau * SR))
    e = 1.0
    env = [0.0] * n
    for i in range(n):
        env[i] = e
        e *= k
    return env


def to_peak(sig, peak_db):
    hi = max(1e-9, max(abs(v) for v in sig))
    if hi <= 1e-9:
        return sig
    k = db(peak_db) / hi
    return [v * k for v in sig]


def lowpass(sig, fc, passes=1):
    a = math.exp(-2.0 * math.pi * fc / SR)
    out = sig[:]
    for _ in range(passes):
        y = 0.0
        for i, v in enumerate(out):
            y += (1.0 - a) * (v - y)
            out[i] = y
    return out


def bandpass_noise(dur, lo, hi, tau):
    """带通噪声脉冲：金属敲击的「击」感全靠它"""
    n = int(SR * dur)
    a_lo = math.exp(-2.0 * math.pi * lo / SR)
    a_hi = math.exp(-2.0 * math.pi * hi / SR)
    x_prev = 0.0
    hp = 0.0
    lp = 0.0
    out = [0.0] * n
    for i in range(n):
        x = rng.uniform(-1.0, 1.0)
        hp = a_lo * (hp + x - x_prev)
        x_prev = x
        lp += (1.0 - a_hi) * (hp - lp)
        out[i] = lp * math.exp(-i / (tau * SR))
    return out


# ------------------------------------------------------------------ 混响（Freeverb 常量）

COMB_D = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
ALLPASS_D = [556, 441, 341, 225]


def _comb(x, delay, g, damp):
    buf = [0.0] * delay
    out = [0.0] * len(x)
    idx = 0
    store = 0.0
    for i, v in enumerate(x):
        y = buf[idx]
        store = y * (1.0 - damp) + store * damp
        buf[idx] = v + store * g
        out[i] = y
        idx += 1
        if idx == delay:
            idx = 0
    return out


def _allpass(x, delay, g):
    buf = [0.0] * delay
    out = [0.0] * len(x)
    idx = 0
    for i, v in enumerate(x):
        bufout = buf[idx]
        out[i] = bufout - v
        buf[idx] = v + bufout * g
        idx += 1
        if idx == delay:
            idx = 0
    return out


def reverb_channel(x, rt60, damp=0.28):
    n = len(x)
    wet = [0.0] * n
    for d in COMB_D:
        g = 10.0 ** (-3.0 * d / (rt60 * SR))
        c = _comb(x, d, g, damp)
        for i in range(n):
            wet[i] += c[i]
    inv = 1.0 / len(COMB_D)
    for i in range(n):
        wet[i] *= inv
    for d in ALLPASS_D:
        wet = _allpass(wet, d, 0.5)
    return wet


def to_stereo(x, rt60=None, wet=0.0, spread=23, damp=0.28, peak_db=None):
    """干声居中；湿声左右用不同延迟起点，得到自然的宽度。

    peak_db 在湿声叠加**之后**才归一化——叠混响会抬高峰值，
    先归一化再混响会让成品电平偏离设计值。
    """
    if not rt60 or wet <= 0:
        chans = [x[:], x[:]]
    else:
        lw = reverb_channel(x, rt60, damp)
        rw = reverb_channel([0.0] * spread + x, rt60, damp)[:len(x)]
        L = [x[i] + wet * lw[i] for i in range(len(x))]
        R = [x[i] + wet * rw[i] for i in range(len(x))]
        chans = [L, R]
    if peak_db is not None:
        hi = max(max(abs(v) for v in chans[0]), max(abs(v) for v in chans[1]))
        if hi > 1e-9:
            k = db(peak_db) / hi
            for c in chans:
                for i in range(len(c)):
                    c[i] *= k
    return chans


# ------------------------------------------------------------------ 音色

# 钟体分音：(频率倍数, 幅度, 相对衰减时长)；第 5 分音（1.19 倍）在完整 Risset 表里最强，
# 这里取含 1.19 的简化表，比例与衰减关系照原表
BELL_PARTIALS = [
    (1.00, 1.00, 1.00),
    (1.19, 0.52, 0.65),   # 钟体的「嗡」；压低到不夺基频，音高阶梯才听得清
    (2.00, 0.30, 0.55),
    (2.76, 0.50, 0.42),
    (4.07, 0.18, 0.28),
    (5.40, 0.14, 0.20),
    (8.93, 0.07, 0.13),
    (13.34, 0.04, 0.08),
]


def bell(freq, dur, tau=0.11, bright=1.0, detune_cents=2.0, click=0.25, partials=BELL_PARTIALS):
    """金属体：瞬态 + 非谐分音 + 拍频"""
    n = int(SR * dur)
    nyq = 0.45 * SR
    out = [0.0] * n
    for mult, amp, rel in partials:
        base = freq * mult
        if base >= nyq:
            continue
        a = amp
        if mult > 1.01:
            a *= bright
            if base > 8000:
                a *= 0.12
            elif base > 4000:
                a *= 0.35
        cents = detune_cents * math.sqrt(mult)
        for sgn in (1.0, -1.0):
            f = base * (1.0 + sgn * cents / 1200.0)
            if f <= 0.0 or f >= nyq:
                continue
            w = 2.0 * math.pi * f / SR
            k = math.exp(-1.0 / (tau * rel * SR))
            e = 1.0
            half = 0.5 * a
            for i in range(n):
                out[i] += half * e * math.sin(w * i)
                e *= k
    if click > 0:
        mix_at(out, bandpass_noise(0.03, 3500, 6500, 0.005), 0.0, click)
    return fade(out, 1.0, 40.0)


def pluck(freq, dur, decay=0.996, bright=0.5, body=0.35):
    """Karplus-Strong 拨弦 + 简易琴体共鸣"""
    n = int(SR * dur)
    N = max(2, int(round(SR / freq)))
    buf = [rng.uniform(-1.0, 1.0) * (1.0 - bright) +
           (1.0 if i % 2 == 0 else -1.0) * bright for i in range(N)]
    out = [0.0] * n
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        out[i] = cur
        buf[idx] = (cur + prev) * 0.5 * decay
        prev = cur
        idx += 1
        if idx == N:
            idx = 0
    if body > 0:
        warm = lowpass(out, 1300.0, 1)
        for i in range(n):
            out[i] += body * warm[i]
    return fade(out, 1.2, 45.0)


def wood_tick(freq=880.0, dur=0.10, tau=0.016, glide_semi=0.0, lp=None, click=0.35):
    """木鱼 / 竹梆：共鸣峰叠加 + 短促噪声击点"""
    n = int(SR * dur)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = freq * (2.0 ** (glide_semi * t / 12.0))
        phase += 2.0 * math.pi * f / SR
        e = math.exp(-i / (tau * SR))
        out[i] = (math.sin(phase) + 0.34 * math.sin(2.0 * phase) + 0.12 * math.sin(3.1 * phase)) * e
    if lp:
        out = lowpass(out, lp, 1)
    if click > 0:
        mix_at(out, bandpass_noise(0.015, 2000, 5200, 0.0035), 0.0, click)
    return fade(out, 0.8, 25.0)


def gong(freq, dur, tau=0.7, shimmer=0.5):
    """铜锣：低次非谐分音 + 慢拍频 + 噪声嗡鸣"""
    partials = [(1.00, 1.00, 1.00), (1.48, 0.55, 0.80), (2.11, 0.34, 0.62),
                (3.02, 0.20, 0.45), (4.35, 0.12, 0.30), (6.10, 0.06, 0.20)]
    out = bell(freq, dur, tau, bright=1.0, detune_cents=3.5, click=0.18, partials=partials)
    n = len(out)
    if shimmer > 0:
        noise = [rng.uniform(-1.0, 1.0) for _ in range(n)]
        noise = lowpass(noise, 900.0, 1)
        env = exp_env(n, tau * 0.6)
        for i in range(n):
            out[i] += noise[i] * env[i] * 0.45 * shimmer
    return fade(out, 2.5, 80.0)


def breath_tone(freq, dur, tau=0.5, vib=5.0, lp=1600.0):
    """箫 / 木管：正弦 + 气息噪声 + 轻微颤音"""
    n = int(SR * dur)
    out = [0.0] * n
    phase = 0.0
    env = exp_env(n, tau)
    for i in range(n):
        t = i / SR
        f = freq * (1.0 + 0.004 * math.sin(2.0 * math.pi * vib * t))
        phase += 2.0 * math.pi * f / SR
        out[i] = math.sin(phase) * env[i]
    air = lowpass([rng.uniform(-1.0, 1.0) for _ in range(n)], 2400.0, 1)
    for i in range(n):
        out[i] = (out[i] + 0.18 * air[i] * env[i] ** 0.6)
    if lp:
        out = lowpass(out, lp, 1)
    return fade(out, 6.0, 60.0)


# ------------------------------------------------------------------ 具体音效

# A 五声音阶（消除音逐层升高，第 7 层封顶）
PENTA = [880.00, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00]


def sfx_match(step):
    """消除音：玉磬。每层 +1 音级、音量 +0.7 dB、亮度 ×1.12、衰减 ×0.93"""
    f = PENTA[max(0, min(len(PENTA) - 1, step))]
    gain = db(0.7 * step)
    tau = 0.115 * (0.93 ** step)
    bright = 1.12 ** step
    out = bell(f, 0.78, tau=tau, bright=bright, detune_cents=2.2, click=0.26)
    for i in range(len(out)):
        out[i] *= gain
    out = to_peak(out, -6.0)
    # 消除音保持单声道：连锁时会同时叠 4–6 个，立体声会互相抵消相位
    wet = reverb_channel(out, 0.45)
    for i in range(len(out)):
        out[i] += 0.15 * wet[i]
    return [to_peak(out, -6.0)]


def sfx_swap():
    """交换：轻竹梆 + 一点玉磬的高音点"""
    out = zeros(0.16)
    mix_at(out, wood_tick(1040.0, 0.10, 0.013, click=0.3), 0.0, 1.0)
    mix_at(out, bell(1760.0, 0.14, tau=0.03, click=0.1), 0.0, 0.16)
    return [to_peak(fade(out, 1.0, 25.0), -11.0)]


def sfx_invalid():
    """无效操作：闷、短、下行、低音量 —— 与有效操作的亮、上行形成对比"""
    out = zeros(0.16)
    mix_at(out, wood_tick(220.0, 0.13, 0.030, glide_semi=-2.2, lp=900.0, click=0.5), 0.0, 1.0)
    return [to_peak(out, -14.0)]


def sfx_click():
    out = wood_tick(1180.0, 0.08, 0.010, click=0.4)
    return [to_peak(fade(out, 0.8, 20.0), -13.0)]


def sfx_star():
    out = zeros(0.6)
    mix_at(out, bell(1318.51, 0.55, tau=0.10, click=0.3), 0.0, 1.0)
    mix_at(out, bell(2637.02, 0.35, tau=0.05, click=0.15), 0.02, 0.35)
    return [to_peak(fade(out, 1.0, 40.0), -6.0)]


def sfx_wind():
    """风符：折扇展开的呼啸 + 竹骨声"""
    n = int(SR * 0.44)
    out = [0.0] * n
    y = 0.0
    for i in range(n):
        t = i / n
        lp = 0.02 + 0.30 * t * t
        x = rng.uniform(-1.0, 1.0)
        y += lp * (x - y)
        env = math.sin(math.pi * min(1.0, t * 1.05)) ** 1.5
        out[i] = (y + (x - y) * 0.5 * t) * env
    mix_at(out, wood_tick(620.0, 0.09, 0.012), 0.30, 0.22)
    out = to_peak(fade(out, 3.0, 60.0), -8.0)
    return to_stereo(out, rt60=0.5, wet=0.18, peak_db=-8.0)


def sfx_thunder():
    """惊雷：裂响瞬态 + 低频闷响 + 隆隆尾巴"""
    out = zeros(0.95)
    mix_at(out, bandpass_noise(0.18, 1200, 7000, 0.030), 0.0, 0.9)
    n = int(SR * 0.6)
    thud = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = 92.0 * (1.0 - 0.55 * t)
        phase += 2.0 * math.pi * f / SR
        thud[i] = math.sin(phase) * math.exp(-i / (0.15 * SR))
    mix_at(out, thud, 0.0, 1.0)
    mix_at(out, lowpass([rng.uniform(-1.0, 1.0) for _ in range(int(SR * 0.75))], 260.0, 1), 0.02, 0.5)
    out = to_peak(fade(out, 1.0, 60.0), -4.0)
    return to_stereo(out, rt60=0.9, wet=0.22, peak_db=-4.0)


def sfx_taiji():
    """太极：铜锣 + 高音闪烁 + 宽混响"""
    out = zeros(1.6)
    mix_at(out, gong(174.61, 1.55, tau=0.62), 0.0, 1.0)
    mix_at(out, bell(2093.0, 0.7, tau=0.14, click=0.2), 0.05, 0.18)
    mix_at(out, bandpass_noise(0.5, 2500, 8000, 0.10), 0.04, 0.18)
    out = to_peak(fade(out, 2.0, 90.0), -3.0)
    return to_stereo(out, rt60=1.2, wet=0.30, spread=31, peak_db=-3.0)


def sfx_break():
    """破障：石 / 冰的脆裂 + 碎屑"""
    out = zeros(0.5)
    mix_at(out, bandpass_noise(0.16, 1800, 8000, 0.028), 0.0, 1.0)
    mix_at(out, wood_tick(320.0, 0.22, 0.045, lp=1200.0, click=0.25), 0.0, 0.35)
    for i in range(5):
        mix_at(out, bandpass_noise(0.05, 1500, 6000, 0.010),
               0.05 + rng.uniform(0, 0.24), 0.24 * rng.uniform(0.5, 1.0))
    out = to_peak(fade(out, 1.0, 40.0), -8.0)
    return [out]


def sfx_shuffle():
    """洗牌：一串竹简摩擦"""
    out = zeros(0.62)
    for i in range(7):
        at = i * 0.072 + rng.uniform(-0.012, 0.012)
        mix_at(out, bandpass_noise(0.07, 1200, 5000, 0.018), max(0.0, at), 0.42)
        mix_at(out, wood_tick(rng.uniform(520, 900), 0.05, 0.009, click=0.3), max(0.0, at), 0.30)
    return [to_peak(fade(out, 1.5, 40.0), -10.0)]


def sfx_win():
    """胜利：A 宫五声上行琶音 + 主和弦落点"""
    out = zeros(3.1)
    notes = [440.00, 493.88, 554.37, 659.25, 739.99, 880.00]
    for i, f in enumerate(notes):
        mix_at(out, pluck(f, 1.3, decay=0.9962), i * 0.09, 1.0)
    chord_at = 0.62
    for f, g in ((110.00, 0.9), (164.81, 0.7), (220.00, 0.8), (277.18, 0.5), (329.63, 0.45)):
        mix_at(out, pluck(f, 2.0, decay=0.9972, body=0.45), chord_at, g * 0.8)
    mix_at(out, bell(1760.0, 1.2, tau=0.22, click=0.25), chord_at, 0.22)
    out = to_peak(fade(out, 2.0, 90.0), -3.0)
    return to_stereo(out, rt60=1.2, wet=0.30, spread=27, peak_db=-3.0)


def sfx_lose():
    """失败：下行三音，柔和克制，不作惩罚性刺耳"""
    out = zeros(2.3)
    seq = [(220.00, 0.0), (185.00, 0.30), (146.83, 0.60)]
    for f, at in seq:
        mix_at(out, breath_tone(f, 1.0, tau=0.42, lp=1600.0), at, 0.95)
    mix_at(out, lowpass([rng.uniform(-1.0, 1.0) for _ in range(int(SR * 1.4))], 200.0, 1), 0.0, 0.35)
    out = to_peak(fade(out, 6.0, 90.0), -6.0)
    return to_stereo(out, rt60=0.7, wet=0.14, spread=19, peak_db=-6.0)


# ------------------------------------------------------------------ 局内技能（灵力）
# 四个技能各有一条起手音，听感必须明显区别于普通消除：
# 普通消除是清净的玉磬，技能是「有分量的一击」，所以都带冲击或风啸。

def sfx_skill_hammer():
    """如意锤：实心一击 —— 低频冲击 + 木梆 + 金属脆响，短促有力"""
    out = zeros(0.62)
    n = int(SR * 0.30)
    thud = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = 96.0 * (1.0 - 0.46 * t)
        phase += 2.0 * math.pi * f / SR
        thud[i] = math.sin(phase) * math.exp(-i / (0.085 * SR))
    mix_at(out, thud, 0.0, 1.0)
    mix_at(out, wood_tick(420.0, 0.20, 0.030, lp=2200.0, click=0.34), 0.0, 0.55)
    mix_at(out, bandpass_noise(0.12, 2200, 9000, 0.020), 0.0, 0.55)
    mix_at(out, bell(1318.51, 0.34, tau=0.060, click=0.14), 0.008, 0.30)
    out = to_peak(fade(out, 1.0, 55.0), -5.0)
    return to_stereo(out, rt60=0.55, wet=0.16, peak_db=-5.0)


def sfx_skill_cross():
    """移山：整行整列裂开 —— 上行风啸 + 铜锣 + 双层低频冲击，四个技能里最重的一条"""
    out = zeros(1.75)
    # 风啸：三段带通噪声依次抬高中心频率并加重，听起来是往上冲的气流
    for i, (lo, hi, at, g) in enumerate((
            (500, 2600, 0.00, 0.34), (1100, 4800, 0.11, 0.46), (2200, 9000, 0.22, 0.58))):
        mix_at(out, bandpass_noise(0.30, lo, hi, 0.055), at, g)
    # 落点：铜锣 + 一层裂响
    mix_at(out, bandpass_noise(0.24, 900, 6500, 0.042), 0.31, 0.85)
    mix_at(out, gong(130.81, 1.50, tau=0.55, shimmer=0.62), 0.31, 0.90)
    n = int(SR * 0.50)
    thud = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = 84.0 * (1.0 - 0.50 * t)
        phase += 2.0 * math.pi * f / SR
        thud[i] = math.sin(phase) * math.exp(-i / (0.13 * SR))
    mix_at(out, thud, 0.31, 1.0)
    out = to_peak(fade(out, 1.5, 90.0), -3.0)
    return to_stereo(out, rt60=1.30, wet=0.28, spread=29, peak_db=-3.0)


def sfx_skill_color():
    """灵犀一点：点石成色 —— 三音上行 + 高频闪片，轻盈通透不吓人"""
    out = zeros(1.05)
    for i, f in enumerate((1046.50, 1318.51, 1567.98)):
        mix_at(out, bell(f, 0.55, tau=0.085 + 0.02 * i, bright=1.10 + 0.15 * i, click=0.18),
               i * 0.055, 0.55 - 0.09 * i)
    mix_at(out, bandpass_noise(0.42, 3500, 9500, 0.090), 0.10, 0.20)
    out = to_peak(fade(out, 1.2, 60.0), -7.0)
    return to_stereo(out, rt60=1.00, wet=0.26, spread=25, peak_db=-7.0)


def sfx_skill_swap():
    """换天：全盘搅动 —— 竹简摩擦成串逐张加快，末尾一声玉磬定位"""
    out = zeros(1.00)
    for i in range(11):
        at = i * 0.048 + rng.uniform(-0.008, 0.008)
        mix_at(out, bandpass_noise(0.06, 1400 + i * 260, 5200 + i * 320, 0.016), max(0.0, at), 0.34)
        mix_at(out, wood_tick(rng.uniform(620, 1180) + i * 22, 0.05, 0.008, click=0.28), max(0.0, at), 0.26)
    mix_at(out, bell(1760.0, 0.62, tau=0.100, click=0.16), 0.56, 0.42)
    out = to_peak(fade(out, 1.5, 70.0), -8.0)
    return to_stereo(out, rt60=0.70, wet=0.18, spread=21, peak_db=-8.0)


# ------------------------------------------------------------------ 输出

def write_wav(name, channels, peak_guard=-1.0):
    """channels: [mono] 或 [L, R]；写文件前做一次真峰值保护"""
    n = max(len(c) for c in channels)
    for c in channels:
        c.extend([0.0] * (n - len(c)))
    hi = max(1e-9, max(abs(v) for c in channels for v in c))
    limit = db(peak_guard)
    k = 1.0 if hi <= limit else limit / hi
    data = bytearray()
    for i in range(n):
        for c in channels:
            v = int(max(-1.0, min(1.0, c[i] * k)) * 32767)
            data += struct.pack('<h', v)
    path = os.path.join(OUT_DIR, name)
    os.makedirs(OUT_DIR, exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(len(channels))
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(data))
    return len(data), len(channels)


def main():
    sounds = []
    for i in range(7):
        sounds.append(('match%d.wav' % (i + 1), sfx_match(i)))
    sounds += [
        ('swap.wav', sfx_swap()),
        ('invalid.wav', sfx_invalid()),
        ('click.wav', sfx_click()),
        ('star.wav', sfx_star()),
        ('wind.wav', sfx_wind()),
        ('thunder.wav', sfx_thunder()),
        ('taiji.wav', sfx_taiji()),
        ('break.wav', sfx_break()),
        ('shuffle.wav', sfx_shuffle()),
        ('win.wav', sfx_win()),
        ('lose.wav', sfx_lose()),
        ('skill_hammer.wav', sfx_skill_hammer()),
        ('skill_cross.wav', sfx_skill_cross()),
        ('skill_color.wav', sfx_skill_color()),
        ('skill_swap.wav', sfx_skill_swap()),
    ]
    total = 0
    for name, chans in sounds:
        size, nch = write_wav(name, chans)
        total += size
        print('  %-14s %6.1f KB  %dch  %.2fs' % (name, size / 1024.0, nch, len(chans[0]) / SR))
    print('共 %d 个音效，%.2f MB → %s' % (len(sounds), total / 1048576.0, os.path.normpath(OUT_DIR)))


if __name__ == '__main__':
    main()
