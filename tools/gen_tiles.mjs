/* 玲珑消 · tools/gen_tiles.mjs — 生成全部 SVG 精灵
 *
 *   node tools/gen_tiles.mjs
 *
 * 统一约定：viewBox 0 0 100 100 · 光源左上 · 描边 2.8 · 统一投影滤镜。
 * 这样六种块的体积感与风格严格一致，替换其中任何一个都不会破坏整体。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'img');
mkdirSync(OUT, { recursive: true });

/* ---------- 基础模板 ---------- */

const PALETTE = {
  jade:    { main: '#2FA98C', light: '#93E2C6', dark: '#12523F' },
  lantern: { main: '#D9453C', light: '#F79C90', dark: '#8C1F1F' },
  coin:    { main: '#D9A63C', light: '#F6DC8E', dark: '#8A5E14' },
  fan:     { main: '#4A6FB5', light: '#A0BBEA', dark: '#27406E' },
  lotus:   { main: '#E28BA8', light: '#F9C9D8', dark: '#A34E6D' },
  sachet:  { main: '#8A5FB0', light: '#C9A7E6', dark: '#543673' }
};

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

function defs(p) {
  return `<defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.light}"/><stop offset="1" stop-color="${p.main}"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${p.dark}"/><stop offset="1" stop-color="${p.main}"/>
    </linearGradient>
    <radialGradient id="hl" cx="0.34" cy="0.26" r="0.58">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.60"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="sh" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="2.4" stdDeviation="2.2" flood-color="#2b2118" flood-opacity="0.34"/>
    </filter>
  </defs>`;
}

/* body: 主形体（填充用 url(#g)）；gloss: 高光路径（用 url(#hl) 填充） */
function tileSvg(p, body, gloss) {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs(p)}
  <g filter="url(#sh)">${body}</g>
  <g pointer-events="none">${gloss || ''}</g>
</svg>
`;
}

const stroke = (p, w) => `fill="url(#g)" stroke="${p.dark}" stroke-width="${w || 2.8}" stroke-linejoin="round"`;

/* ---------- 六种基础块 ---------- */

function jadeBi(p) {
  /* 玉璧：外圆内孔（evenodd 挖空）+ 谷纹 */
  const body = `<path d="M50 7 A43 43 0 1 0 50 93 A43 43 0 1 0 50 7 Z M50 33 A17 17 0 1 1 50 67 A17 17 0 1 1 50 33 Z"
      fill-rule="evenodd" ${stroke(p)}/>
    <path d="M50 18 A32 32 0 0 1 78 34" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="3" stroke-linecap="round"/>
    <g fill="${p.dark}" opacity="0.5">
      <circle cx="50" cy="18" r="2.1"/><circle cx="74" cy="32" r="2.1"/><circle cx="74" cy="68" r="2.1"/>
      <circle cx="50" cy="82" r="2.1"/><circle cx="26" cy="68" r="2.1"/><circle cx="26" cy="32" r="2.1"/>
    </g>`;
  const gloss = `<path d="M50 7 A43 43 0 1 0 50 93 A43 43 0 1 0 50 7 Z M50 33 A17 17 0 1 1 50 67 A17 17 0 1 1 50 33 Z"
      fill-rule="evenodd" fill="url(#hl)"/>`;
  return tileSvg(p, body, gloss);
}

function lantern(p) {
  const body = `<path d="M50 15 C73 15 84 31 84 48 C84 67 69 81 50 81 C31 81 16 67 16 48 C16 31 27 15 50 15 Z"
      ${stroke(p)}/>
    <rect x="36" y="7" width="28" height="10" rx="3.5" fill="url(#g2)" stroke="${p.dark}" stroke-width="2.4"/>
    <rect x="39" y="79" width="22" height="9" rx="3.5" fill="url(#g2)" stroke="${p.dark}" stroke-width="2.4"/>
    <path d="M50 88 L50 96" fill="none" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 96 l-5 -4 M50 96 l5 -4" fill="none" stroke="${p.dark}" stroke-width="2.4" stroke-linecap="round"/>
    <g fill="none" stroke="${p.dark}" stroke-width="1.7" opacity="0.55">
      <path d="M50 16 V80"/><path d="M34 19 C28 32 28 64 34 78"/><path d="M66 19 C72 32 72 64 66 78"/>
    </g>`;
  const gloss = `<path d="M50 15 C73 15 84 31 84 48 C84 67 69 81 50 81 C31 81 16 67 16 48 C16 31 27 15 50 15 Z" fill="url(#hl)"/>`;
  return tileSvg(p, body, gloss);
}

function coin(p) {
  const body = `<path d="M50 6 A44 44 0 1 0 50 94 A44 44 0 1 0 50 6 Z M37 37 H63 V63 H37 Z"
      fill-rule="evenodd" ${stroke(p)}/>
    <circle cx="50" cy="50" r="35" fill="none" stroke="${p.dark}" stroke-width="1.8" opacity="0.5"/>
    <rect x="37" y="37" width="26" height="26" fill="none" stroke="${p.dark}" stroke-width="2.2" opacity="0.75"/>
    <g fill="none" stroke="${p.dark}" stroke-width="2.4" opacity="0.62" stroke-linecap="round">
      <path d="M22 50 h8"/><path d="M70 50 h8"/><path d="M50 22 v8"/><path d="M50 70 v8"/>
    </g>`;
  const gloss = `<path d="M50 6 A44 44 0 1 0 50 94 A44 44 0 1 0 50 6 Z M37 37 H63 V63 H37 Z"
      fill-rule="evenodd" fill="url(#hl)"/>`;
  return tileSvg(p, body, gloss);
}

function fan(p) {
  /* 折扇：开角更宽、扇骨更密，扇面加一道束带 */
  const body = `<path d="M50 90 L6 64 Q50 24 94 64 Z" ${stroke(p)}/>
    <path d="M14 68 Q50 34 86 68" fill="none" stroke="${p.light}" stroke-width="4" opacity="0.55"/>
    <g fill="none" stroke="${p.dark}" stroke-width="1.7" opacity="0.7" stroke-linecap="round">
      <path d="M50 90 L19 54.5"/><path d="M50 90 L34 47.5"/><path d="M50 90 L50 45"/>
      <path d="M50 90 L66 47.5"/><path d="M50 90 L81 54.5"/>
    </g>
    <path d="M6 64 Q50 24 94 64" fill="none" stroke="${p.dark}" stroke-width="2.6" opacity="0.85"/>
    <path d="M9 66.5 Q50 28 91 66.5" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.4"/>
    <circle cx="50" cy="90" r="6.3" fill="url(#g2)" stroke="${p.dark}" stroke-width="2.4"/>
    <path d="M50 96 L50 99" fill="none" stroke="${p.dark}" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>`;
  const gloss = `<path d="M50 90 L6 64 Q50 24 94 64 Z" fill="url(#hl)"/>`;
  return tileSvg(p, body, gloss);
}

function lotus(p) {
  const petal = (rot) => `<ellipse cx="50" cy="31" rx="13.5" ry="22" transform="rotate(${rot} 50 54)" ${stroke(p, 2.6)}/>`;
  const body = `<g>${[0, 54, -54, 108, -108].map(petal).join('')}</g>
    <circle cx="50" cy="54" r="12" fill="url(#g2)" stroke="${p.dark}" stroke-width="2.6"/>
    <circle cx="50" cy="54" r="5" fill="${p.light}" opacity="0.85"/>`;
  const gloss = `<ellipse cx="50" cy="31" rx="13.5" ry="22" fill="url(#hl)"/>`;
  return tileSvg(p, body, gloss);
}

function sachet(p) {
  const body = `<path d="M50 24 C73 24 82 42 80 60 C78 78 65 90 50 90 C35 90 22 78 20 60 C18 42 27 24 50 24 Z"
      ${stroke(p)}/>
    <path d="M50 24 C50 24 44 14 36 11 M50 24 C50 24 56 14 64 11" fill="none" stroke="${p.dark}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="50" cy="23" r="7" fill="url(#g2)" stroke="${p.dark}" stroke-width="2.4"/>
    <path d="M50 89 L50 96" fill="none" stroke="${p.dark}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M40 52 Q50 62 60 52" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-linecap="round"/>
    <g fill="none" stroke="${p.dark}" stroke-width="1.6" opacity="0.45">
      <path d="M28 48 Q50 56 72 48"/>
    </g>`;
  const gloss = `<path d="M50 24 C73 24 82 42 80 60 C78 78 65 90 50 90 C35 90 22 78 20 60 C18 42 27 24 50 24 Z" fill="url(#hl)"/>`;
  return tileSvg(p, body, gloss);
}

/* ---------- 特殊块徽记（叠在块之上） ---------- */

function windBadge(vertical) {
  /* 深色圆形底座 + 亮金双向箭头：保证在任何底色上都清晰可读 */
  const arrow = `
    <path d="M22 50 H78" fill="none" stroke="#fffbe8" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M22 50 l14 -10.5 v21 z" fill="#fffbe8"/>
    <path d="M78 50 l-14 -10.5 v21 z" fill="#fffbe8"/>
    <circle cx="50" cy="50" r="6.6" fill="#ffe9a8"/>`;
  const g = `
    <circle cx="50" cy="50" r="39" fill="rgba(46,32,10,0.68)" stroke="#ffe9a8" stroke-width="3.2"/>
    <g transform="${vertical ? 'rotate(90 50 50)' : ''}">${arrow}</g>`;
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="gl" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ffe9a8" flood-opacity="0.95"/>
    </filter>
  </defs>
  <g filter="url(#gl)">${g}</g>
</svg>
`;
}

function thunderBadge() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="gl" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="3.2" flood-color="#ffd98a" flood-opacity="0.95"/>
    </filter>
  </defs>
  <g filter="url(#gl)">
    <path d="M58 6 L24 54 h17 L38 94 L76 42 H55 Z" fill="#fff6cf" stroke="#8a5a12" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M54 20 L34 50 h14 L42 76" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>
`;
}

function taijiBadge() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="gl" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="2.6" flood-color="#d8c8ff" flood-opacity="0.9"/>
    </filter>
  </defs>
  <g filter="url(#gl)">
    <circle cx="50" cy="50" r="44" fill="#f8f3e4" stroke="#2b241c" stroke-width="3"/>
    <path d="M50 6 a22 22 0 0 1 0 44 a22 22 0 0 0 0 44 a44 44 0 0 1 0 -88" fill="#2b241c"/>
    <circle cx="50" cy="28" r="7.4" fill="#f8f3e4"/>
    <circle cx="50" cy="72" r="7.4" fill="#2b241c"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.6"/>
  </g>
</svg>
`;
}

/* ---------- 障碍覆盖 ---------- */

function obstFrost() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g>
    <rect x="4" y="4" width="92" height="92" rx="18" fill="rgba(206,236,250,0.55)" stroke="rgba(255,255,255,0.9)" stroke-width="3"/>
    <rect x="9" y="9" width="82" height="82" rx="14" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.6"/>
    <g stroke="rgba(255,255,255,0.92)" stroke-width="3.4" stroke-linecap="round">
      <path d="M50 16 V84"/><path d="M21 33 L79 67"/><path d="M79 33 L21 67"/>
    </g>
    <g stroke="rgba(150,196,224,0.85)" stroke-width="2" stroke-linecap="round">
      <path d="M50 16 l-7 9 M50 16 l7 9"/><path d="M50 84 l-7 -9 M50 84 l7 -9"/>
      <path d="M21 33 l11 1 M21 33 l-1 11"/><path d="M79 67 l-11 -1 M79 67 l1 -11"/>
      <path d="M79 33 l-11 1 M79 33 l1 11"/><path d="M21 67 l11 -1 M21 67 l-1 -11"/>
    </g>
  </g>
</svg>
`;
}

function obstStone() {
  /* 石锁：半透明石环 + 铆钉，压在块上但不过分抢眼 */
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(176,168,156,0.90)"/>
      <stop offset="1" stop-color="rgba(122,113,101,0.90)"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.8" flood-color="#3a3026" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#sh)">
    <rect x="6.5" y="6.5" width="87" height="87" rx="15" fill="none" stroke="url(#sg)" stroke-width="12"/>
    <rect x="6.5" y="6.5" width="87" height="87" rx="15" fill="none" stroke="rgba(74,68,60,0.85)" stroke-width="1.6"/>
    <rect x="13" y="13" width="74" height="74" rx="10" fill="none" stroke="rgba(74,68,60,0.55)" stroke-width="1.3"/>
    <g fill="rgba(226,220,208,0.92)" stroke="rgba(74,68,60,0.5)" stroke-width="1">
      <circle cx="17" cy="17" r="3.6"/><circle cx="83" cy="17" r="3.6"/>
      <circle cx="17" cy="83" r="3.6"/><circle cx="83" cy="83" r="3.6"/>
    </g>
    <g fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round">
      <path d="M22 9.5 H78"/><path d="M9.5 22 V78"/>
    </g>
  </g>
</svg>
`;
}

function obstVine() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6fae5e"/><stop offset="1" stop-color="#3c6f38"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke="url(#vg)" stroke-width="7" stroke-linecap="round">
    <path d="M4 26 Q30 44 52 24 Q74 4 96 26"/>
    <path d="M4 74 Q30 56 52 76 Q74 96 96 74"/>
    <path d="M26 4 Q44 32 24 54 Q6 74 26 96"/>
    <path d="M74 4 Q56 32 76 54 Q94 74 74 96"/>
  </g>
  <g fill="#4f8b45" opacity="0.95">
    <ellipse cx="22" cy="16" rx="7" ry="4" transform="rotate(-28 22 16)"/>
    <ellipse cx="78" cy="18" rx="7" ry="4" transform="rotate(26 78 18)"/>
    <ellipse cx="20" cy="84" rx="7" ry="4" transform="rotate(24 20 84)"/>
    <ellipse cx="80" cy="82" rx="7" ry="4" transform="rotate(-24 80 82)"/>
    <ellipse cx="50" cy="50" rx="6" ry="3.6" transform="rotate(40 50 50)"/>
  </g>
</svg>
`;
}

/* ---------- UI 图标 ---------- */

function star(on) {
  const fill = on ? 'url(#sg)' : 'none';
  const strokeCol = on ? '#8a5c12' : 'rgba(120,96,60,0.55)';
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd873"/><stop offset="1" stop-color="#d99a24"/>
    </linearGradient>
    <filter id="sh" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#7a5310" flood-opacity="0.45"/>
    </filter>
  </defs>
  <path filter="url(#sh)" d="M50 6 L62.5 37.5 L96 40 L70.5 62 L78 94 L50 77 L22 94 L29.5 62 L4 40 L37.5 37.5 Z"
    fill="${fill}" stroke="${strokeCol}" stroke-width="3.4" stroke-linejoin="round" opacity="${on ? 1 : 0.6}"/>
</svg>
`;
}

function lock() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="none" stroke="#7a6a52" stroke-width="7" stroke-linecap="round">
    <path d="M32 44 V30 a18 18 0 0 1 36 0 V44"/>
  </g>
  <rect x="20" y="42" width="60" height="46" rx="10" fill="#b7a583" stroke="#6d5c42" stroke-width="4"/>
  <circle cx="50" cy="62" r="7" fill="#4a3f2e"/>
  <rect x="46.5" y="62" width="7" height="16" rx="3" fill="#4a3f2e"/>
</svg>
`;
}

/* ---------- 界面图标（替代 emoji，跨平台风格统一） ---------- */

const INK = '#4A4038';
const GOLD = '#C9A227';
const CINNABAR = '#B8342C';

function iconPause() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect x="3.5" y="3" width="6.4" height="18" rx="2.4" fill="${INK}"/>
  <rect x="14.1" y="3" width="6.4" height="18" rx="2.4" fill="${INK}"/>
  <rect x="3.5" y="3" width="6.4" height="18" rx="2.4" fill="none" stroke="${GOLD}" stroke-width="0.9" opacity="0.7"/>
  <rect x="14.1" y="3" width="6.4" height="18" rx="2.4" fill="none" stroke="${GOLD}" stroke-width="0.9" opacity="0.7"/>
</svg>
`;
}

function iconSound(muted) {
  const wave = muted
    ? `<path d="M16.2 9.2 L21.4 14.8 M21.4 9.2 L16.2 14.8" fill="none" stroke="${CINNABAR}" stroke-width="2.2" stroke-linecap="round"/>`
    : `<path d="M16.4 8.6 a4.6 4.6 0 0 1 0 6.8" fill="none" stroke="${GOLD}" stroke-width="1.9" stroke-linecap="round"/>
       <path d="M18.9 6.1 a8 8 0 0 1 0 11.8" fill="none" stroke="${GOLD}" stroke-width="1.9" stroke-linecap="round" opacity="0.75"/>`;
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M4 9.2 H7.6 L12.6 4.6 V19.4 L7.6 14.8 H4 Z" fill="${INK}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  ${wave}
</svg>
`;
}

/* 金币：与「铜钱」棋子同源，方便玩家建立联想 */
function iconCoin() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F6DC8E"/><stop offset="1" stop-color="#D9A63C"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="10.4" fill="url(#cg)" stroke="#8A5E14" stroke-width="1.7"/>
  <circle cx="12" cy="12" r="8.2" fill="none" stroke="#8A5E14" stroke-width="0.9" opacity="0.5"/>
  <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="0.7" fill="none" stroke="#8A5E14" stroke-width="1.6"/>
  <path d="M12.6 3.4 a8.8 8.8 0 0 1 5.9 2.5" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round"/>
</svg>
`;
}

/* 开局道具图标：加步（双箭头）· 风符（迷你风纹）· 重排（循环箭头） */
function iconBoost(kind) {
  if (kind === 'moves') {
    return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M3 12 l6.5 -7.5 v15 z" fill="${INK}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
  <path d="M11 12 l6.5 -7.5 v15 z" fill="${GOLD}" stroke="#8A5F18" stroke-width="1" stroke-linejoin="round"/>
  <path d="M19.5 12 h2.5" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>
</svg>
`;
  }
  if (kind === 'wind') {
    return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="none" stroke="${GOLD}" stroke-width="1.8"/>
  <path d="M5.5 12 H18.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M5.5 12 l3.6 -3 v6 z" fill="${INK}"/>
  <path d="M18.5 12 l-3.6 -3 v6 z" fill="${INK}"/>
  <circle cx="12" cy="12" r="1.8" fill="${GOLD}"/>
</svg>
`;
  }
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 9.5 a7.5 7.5 0 0 1 12.5 -2.5"/>
    <path d="M17.5 3.5 V8 h-4.5"/>
    <path d="M19 14.5 a7.5 7.5 0 0 1 -12.5 2.5"/>
    <path d="M6.5 20.5 V16 h4.5"/>
  </g>
</svg>
`;
}

function iconBack() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M14.4 4.2 L6.2 12 L14.4 19.8" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.4 4.2 L6.2 12 L14.4 19.8" fill="none" stroke="${GOLD}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
</svg>
`;
}

/* 云纹分割线：中间如意云头 + 两侧渐隐横线 */
function cloudDivider() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 20">
  <g fill="none" stroke="${GOLD}" stroke-width="1.5" stroke-linecap="round" opacity="0.85">
    <path d="M6 10 H68"/><path d="M132 10 H194"/>
    <path d="M100 4.2 c-5.4 0 -8.4 3.4 -8.4 6.2 c0 2.2 1.7 3.6 3.8 3.6 c1.8 0 3 -1.1 3 -2.6 c0 -1.3 -0.9 -2.2 -2.1 -2.2"
      transform="rotate(180 100 10)"/>
    <path d="M100 4.2 c5.4 0 8.4 3.4 8.4 6.2 c0 2.2 -1.7 3.6 -3.8 3.6 c-1.8 0 -3 -1.1 -3 -2.6 c0 -1.3 0.9 -2.2 2.1 -2.2"
      transform="rotate(180 100 10)"/>
    <circle cx="100" cy="3.6" r="1.7" fill="${GOLD}" stroke="none"/>
  </g>
</svg>
`;
}

/* 面板四角装饰：同一母题按四角镜像出四个文件 */
function panelCorner(corner) {
  const body = `<g fill="none" stroke="${GOLD}" stroke-width="1.5" stroke-linecap="round" opacity="0.9">
    <path d="M2.5 12.5 V7 a4.5 4.5 0 0 1 4.5 -4.5 h5.5"/>
    <path d="M6 12.5 V8.6 a2.6 2.6 0 0 1 2.6 -2.6 h4"/>
    <circle cx="5" cy="5" r="1.5" fill="${GOLD}" stroke="none"/>
  </g>`;
  const sx = corner.indexOf('r') >= 0 ? -1 : 1;
  const sy = corner.indexOf('b') >= 0 ? -1 : 1;
  const tf = (sx === 1 && sy === 1) ? '' :
    ` transform="translate(${sx === -1 ? 24 : 0} ${sy === -1 ? 24 : 0}) scale(${sx} ${sy})"`;
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g${tf}>${body}</g></svg>
`;
}

/* ---------- 背景与边框 ---------- */

/* 水墨远山：三层山脊 + 云雾带，用于标题页与加载页背景 */
function ridgePath(pts, base) {
  let d = `M${pts[0][0]} ${base} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const x0 = pts[i - 1][0], y0 = pts[i - 1][1];
    const x1 = pts[i][0], y1 = pts[i][1];
    d += ` Q${((x0 + x1) / 2).toFixed(0)} ${(Math.min(y0, y1) - 9).toFixed(0)} ${x1} ${y1}`;
  }
  d += ` L${pts[pts.length - 1][0]} ${base} Z`;
  return d;
}

function bgMountains() {
  const far = [[0, 266], [150, 148], [340, 236], [570, 138], [810, 228], [1040, 156], [1270, 242], [1510, 168], [1760, 232], [1920, 190]];
  const mid = [[0, 322], [120, 212], [330, 302], [580, 176], [820, 286], [1080, 206], [1320, 298], [1560, 192], [1800, 270], [1920, 234]];
  const near = [[0, 392], [220, 298], [460, 370], [720, 252], [980, 354], [1240, 284], [1500, 364], [1760, 294], [1920, 342]];
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 480" preserveAspectRatio="xMidYMax slice">
  <defs>
    <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7E9A82" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#7E9A82" stop-opacity="0.10"/>
    </linearGradient>
    <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A6B52" stop-opacity="0.56"/>
      <stop offset="1" stop-color="#4A6B52" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2F4A3A" stop-opacity="0.68"/>
      <stop offset="1" stop-color="#2F4A3A" stop-opacity="0.26"/>
    </linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFCF0" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#FFFCF0" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#FFFCF0" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="${ridgePath(far, 480)}" fill="url(#m1)"/>
  <rect x="120" y="286" width="1500" height="26" fill="url(#mist)" opacity="0.55"/>
  <path d="${ridgePath(mid, 480)}" fill="url(#m2)"/>
  <rect x="0" y="356" width="1920" height="30" fill="url(#mist)" opacity="0.6"/>
  <path d="${ridgePath(near, 480)}" fill="url(#m3)"/>
</svg>
`;
}

function bgPaper() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <defs>
    <filter id="fiber" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.014 0.05" numOctaves="3" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="420" height="420" fill="#f3e8d1"/>
  <rect width="420" height="420" filter="url(#fiber)" opacity="0.16"/>
  <rect width="420" height="420" filter="url(#grain)" opacity="0.05"/>
  <g stroke="rgba(160,132,88,0.10)" stroke-width="1">
    <path d="M0 120 H420 M0 262 H420 M140 0 V420 M286 0 V420"/>
  </g>
</svg>
`;
}

function boardFrame() {
  /* 边框贴近画布外缘，角饰收小：绘制时整体套在棋盘外圈，不与棋子重叠 */
  const curl = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})" fill="none" stroke="#8a6a3a" stroke-width="1.9" stroke-linecap="round" opacity="0.8">
      <path d="M0 13 Q0 0 13 0"/>
      <path d="M4 13 Q4 4 13 4"/>
      <path d="M13 0 q7 0 7 5.5 q0 4.6 -4.6 4.6 q-3.7 0 -3.7 -3.7"/>
    </g>`;
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g fill="none" stroke="#8a6a3a" stroke-linecap="round">
    <rect x="2.5" y="2.5" width="195" height="195" rx="14" stroke-width="2.2" opacity="0.72"/>
    <rect x="7.5" y="7.5" width="185" height="185" rx="11" stroke-width="1.1" opacity="0.42"/>
    <rect x="11.5" y="11.5" width="177" height="177" rx="9" stroke-width="1.3" opacity="0.26"/>
  </g>
  ${curl(15, 15, 0)}
  ${curl(185, 15, 90)}
  ${curl(185, 185, 180)}
  ${curl(15, 185, 270)}
  <g fill="none" stroke="#8a6a3a" stroke-width="1.7" stroke-linecap="round" opacity="0.62">
    <path d="M100 2.5 q5.5 5.5 0 11 q-5.5 -5.5 0 -11"/>
    <path d="M100 197.5 q5.5 -5.5 0 -11 q-5.5 5.5 0 11"/>
    <path d="M2.5 100 q5.5 5.5 11 0 q-5.5 -5.5 -11 0"/>
    <path d="M197.5 100 q-5.5 5.5 -11 0 q5.5 -5.5 11 0"/>
  </g>
</svg>
`;
}

/* ---------- 输出 ---------- */

const files = {
  'tile_jade.svg': jadeBi(PALETTE.jade),
  'tile_lantern.svg': lantern(PALETTE.lantern),
  'tile_coin.svg': coin(PALETTE.coin),
  'tile_fan.svg': fan(PALETTE.fan),
  'tile_lotus.svg': lotus(PALETTE.lotus),
  'tile_sachet.svg': sachet(PALETTE.sachet),
  'sp_wind_h.svg': windBadge(false),
  'sp_wind_v.svg': windBadge(true),
  'sp_thunder.svg': thunderBadge(),
  'sp_taiji.svg': taijiBadge(),
  'ob_frost.svg': obstFrost(),
  'ob_stone.svg': obstStone(),
  'ob_vine.svg': obstVine(),
  'ui_star.svg': star(true),
  'ui_star_off.svg': star(false),
  'ui_lock.svg': lock(),
  'ui_coin.svg': iconCoin(),
  'ui_boost_moves.svg': iconBoost('moves'),
  'ui_boost_wind.svg': iconBoost('wind'),
  'ui_boost_shuffle.svg': iconBoost('shuffle'),
  'ui_pause.svg': iconPause(),
  'ui_sound.svg': iconSound(false),
  'ui_mute.svg': iconSound(true),
  'ui_back.svg': iconBack(),
  'ui_cloud.svg': cloudDivider(),
  'ui_corner_tl.svg': panelCorner('tl'),
  'ui_corner_tr.svg': panelCorner('tr'),
  'ui_corner_bl.svg': panelCorner('bl'),
  'ui_corner_br.svg': panelCorner('br'),
  'bg_paper.svg': bgPaper(),
  'bg_mountains.svg': bgMountains(),
  'board_frame.svg': boardFrame()
};

let bytes = 0;
for (const name in files) {
  const svg = files[name];
  writeFileSync(join(OUT, name), svg, 'utf8');
  bytes += Buffer.byteLength(svg, 'utf8');
}
console.log('生成 ' + Object.keys(files).length + ' 个 SVG，共 ' + (bytes / 1024).toFixed(1) + ' KB → ' + OUT);
