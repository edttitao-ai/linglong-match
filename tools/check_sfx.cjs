/* 玲珑消 · tools/check_sfx.cjs — 音效体检
 *
 *   node tools/check_sfx.cjs
 *
 * 只读 WAV 头部与采样数据，检查三件事：
 *   1. 文件可解析（采样率 / 位深 / 声道数）
 *   2. 峰值电平是否符合设计（消除 −6 / UI −12~−14 / 结算 −3 dBFS）
 *   3. match1–match7 的基频是否单调递增（连锁音高阶梯）
 * 基频用自相关法估计（取起音之后的一段稳定波形），无需任何第三方库。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SFX_DIR = path.join(__dirname, '..', 'assets', 'sfx');

function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('不是 WAV：' + file);
  }
  let pos = 12;
  let fmt = null, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14)
      };
    } else if (id === 'data') {
      data = buf.slice(body, body + size);
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('缺少 fmt/data 块：' + file);
  const frames = Math.floor(data.length / (fmt.channels * fmt.bits / 8));
  const ch = [];
  for (let c = 0; c < fmt.channels; c++) ch.push(new Float64Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      const off = (i * fmt.channels + c) * 2;
      ch[c][i] = data.readInt16LE(off) / 32768;
    }
  }
  return { ...fmt, frames, ch };
}

function peakDb(chans) {
  let hi = 0;
  chans.forEach(function (c) {
    for (let i = 0; i < c.length; i++) hi = Math.max(hi, Math.abs(c[i]));
  });
  return 20 * Math.log10(Math.max(1e-9, hi));
}

/* 基频估计：对起音后的窗口做 Goertzel 扫频，取 130–2600 Hz 内的谱峰再做抛物线插值。
 * 自相关法在钟类音色上容易取到倍频，这里改用谱峰更稳。 */
function estimateFreq(sig, sr) {
  /* 取起音后很短的一段（约 100 ms）：人耳锁定音高主要靠起音段，
   * 窗口太长会把钟体的拍频平均掉，反而测到高次分音 */
  const start = Math.floor(sr * 0.006);
  const len = Math.min(4096, sig.length - start);
  if (len < 2048) return 0;
  const win = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    /* Hann 窗，压低旁瓣 */
    win[i] = sig[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (len - 1)));
  }
  const mag = function (f) {
    const w = 2 * Math.PI * f / sr;
    const c = 2 * Math.cos(w);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < len; i++) {
      const s0 = win[i] + c * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2);
  };
  let bestF = 0, bestM = -1;
  for (let f = 130; f <= 2600; f += 4) {
    const m = mag(f);
    if (m > bestM) { bestM = m; bestF = f; }
  }
  if (!bestF) return 0;
  /* 抛物线插值提高分辨率 */
  const a = mag(bestF - 4), b = bestM, c = mag(bestF + 4);
  const denom = (a - 2 * b + c);
  const delta = denom !== 0 ? 0.5 * (a - c) / denom : 0;
  return bestF + delta * 4;
}

const EXPECT = {
  match1: -6, match2: -6, match3: -6, match4: -6, match5: -6, match6: -6, match7: -6,
  win: -3, taiji: -3, thunder: -4, lose: -6, star: -6,
  wind: -8, brk: -8, shuffle: -10, swap: -11, click: -13, invalid: -14
};

const files = fs.readdirSync(SFX_DIR).filter(function (f) { return f.endsWith('.wav'); }).sort();
console.log('文件            声道  时长    峰值dBFS  设计值   基频Hz');
const freqs = [];
for (const f of files) {
  const key = f.replace('.wav', '');
  const w = readWav(path.join(SFX_DIR, f));
  const pk = peakDb(w.ch);
  const f0 = estimateFreq(w.ch[0], w.sampleRate);
  if (key.indexOf('match') === 0) freqs.push({ key: key, f0: f0 });
  const exp = EXPECT[key];
  const flag = (exp != null && Math.abs(pk - exp) > 1.5) ? ' ← 偏离设计值' : '';
  console.log(
    f.padEnd(15, ' ') + String(w.channels).padStart(2) + '   ' +
    (w.frames / w.sampleRate).toFixed(2) + 's  ' +
    pk.toFixed(1).padStart(7) + '  ' +
    (exp == null ? '  -' : String(exp).padStart(5)) + '   ' +
    f0.toFixed(0).padStart(6) + flag
  );
}

/* 连锁音高阶梯检查 */
let mono = true;
for (let i = 1; i < freqs.length; i++) {
  if (freqs[i].f0 <= freqs[i - 1].f0) mono = false;
}
console.log('\n连锁音高阶梯：' + freqs.map(function (x) { return x.f0.toFixed(0); }).join(' → ') + ' Hz');
console.log(mono ? '✓ match1–match7 基频单调递增' : '✗ 连锁音高未单调递增');
process.exit(mono ? 0 : 1);
