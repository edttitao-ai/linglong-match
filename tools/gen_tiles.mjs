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

/* 局内技能图标：如意锤 · 换天（双向交换）· 灵犀一点（点色）· 移山（十字爆破）
 * 与开局道具同理走 24×24 紧凑视图框；四个技能各有独立轮廓，缩小到 26px 也能分辨。 */
function iconSkill(kind) {
  if (kind === 'hammer') {
    return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g transform="rotate(-38 12 12)">
    <rect x="7.2" y="2.4" width="9.6" height="6.8" rx="2.2" fill="${INK}"/>
    <rect x="7.2" y="2.4" width="9.6" height="2.4" rx="1.2" fill="${GOLD}" opacity="0.85"/>
    <rect x="9.8" y="8.8" width="4.4" height="12.4" rx="2.2" fill="${GOLD}" stroke="#8A5F18" stroke-width="0.9"/>
  </g>
  <g stroke="${CINNABAR}" stroke-width="1.5" stroke-linecap="round">
    <path d="M19.4 5.4 l2.1 -2.1"/>
    <path d="M20.4 9.6 h2.2"/>
    <path d="M15.2 3.6 v-2.2"/>
  </g>
</svg>
`;
  }
  if (kind === 'swap') {
    return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M3.6 8.6 h11.8" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round"/>
  <path d="M11.8 4.4 L16.6 8.6 L11.8 12.8" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20.4 15.4 H8.6" fill="none" stroke="${CINNABAR}" stroke-width="2.1" stroke-linecap="round"/>
  <path d="M12.2 11.2 L7.4 15.4 L12.2 19.6" fill="none" stroke="${CINNABAR}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
  }
  if (kind === 'color') {
    return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 2.4 c3.7 4.3 6.1 7.4 6.1 10.4 a6.1 6.1 0 0 1 -12.2 0 c0 -3 2.4 -6.1 6.1 -10.4 z"
        fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="12" cy="13.2" r="2.7" fill="${CINNABAR}"/>
  <circle cx="3.4" cy="6.2" r="1.7" fill="#2FA98C"/>
  <circle cx="20.6" cy="6.2" r="1.7" fill="#4A6FB5"/>
  <circle cx="3.4" cy="19.8" r="1.7" fill="#D9A63C"/>
  <circle cx="20.6" cy="19.8" r="1.7" fill="#8A5FB0"/>
</svg>
`;
  }
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M9.9 2.8 h4.2 v7.1 h7.1 v4.2 h-7.1 v7.1 h-4.2 v-7.1 h-7.1 v-4.2 h7.1 z"
        fill="${CINNABAR}" stroke="#8E231D" stroke-width="1"/>
  <circle cx="12" cy="12" r="2.7" fill="${GOLD}" stroke="#8A5F18" stroke-width="0.9"/>
  <g stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round" opacity="0.9">
    <path d="M12 0.9 v1.5"/><path d="M12 21.6 v1.5"/>
    <path d="M0.9 12 h1.5"/><path d="M21.6 12 h1.5"/>
  </g>
</svg>
`;
}

/* ---------- 成就徽记 ----------
 * 12 个成就各有一枚独立图形。未解锁时列表会把它降饱和到 50% 透明，
 * 所以**轮廓必须能单独表意**——不能靠颜色区分，也不能十二个长一个样。
 * 统一步调：24×24 视图框、只取 2~4 个形状、粗描边，缩到 30px 仍然一眼可辨。 */

/* 五角星路径（外径/内径可调，rot 弧度） */
function starPath(cx, cy, rOut, rIn, rot) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = (i % 2) ? rIn : rOut;
    const a = (rot || 0) + i * Math.PI / 5;
    pts.push((cx + r * Math.sin(a)).toFixed(2) + ' ' + (cy - r * Math.cos(a)).toFixed(2));
  }
  return 'M' + pts.join(' L') + ' Z';
}

function iconAch(id) {
  const head = HEAD + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n';
  const tail = '</svg>\n';
  const GOLD_HI = '#E8C86A';
  const STONE = '#CFD6DC';

  /* 初出茅庐：一颗星 + 起跑线 */
  if (id === 'firstStar') {
    return head +
      `  <path d="${starPath(12, 10.2, 8.2, 3.5, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1.4" stroke-linejoin="round"/>\n` +
      `  <path d="M4.6 21.2 h14.8" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" opacity="0.7"/>\n` + tail;
  }
  /* 小有所成：三颗小星 */
  if (id === 'stars10') {
    return head +
      `  <path d="${starPath(6.2, 7.8, 4.0, 1.7, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1.1" stroke-linejoin="round"/>\n` +
      `  <path d="${starPath(17.8, 7.8, 4.0, 1.7, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1.1" stroke-linejoin="round"/>\n` +
      `  <path d="${starPath(12, 17.0, 4.6, 2.0, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1.2" stroke-linejoin="round"/>\n` + tail;
  }
  /* 渐入佳境：拾级而上 + 星 */
  if (id === 'stars30') {
    return head +
      `  <path d="M3.4 20.8 h5 v-4.4 h4.8 v-4.4 h4.6" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>\n` +
      `  <path d="${starPath(18.2, 7.0, 4.4, 1.9, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1.1" stroke-linejoin="round"/>\n` + tail;
  }
  /* 玲珑满堂：满月 + 两点星 */
  if (id === 'stars60') {
    return head +
      `  <circle cx="12" cy="12.4" r="7.4" fill="#FFF3C4" stroke="#8A5F18" stroke-width="1.5"/>\n` +
      `  <circle cx="12" cy="12.4" r="4.9" fill="none" stroke="${GOLD}" stroke-width="0.9" opacity="0.65"/>\n` +
      `  <path d="${starPath(4.4, 4.4, 2.5, 1.0, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="0.8"/>\n` +
      `  <path d="${starPath(19.8, 5.2, 2.1, 0.9, 0)}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="0.8"/>\n` + tail;
  }
  /* 三星照胆：北斗七星——七颗星靠连线成勺，线要够重才看得出是「星座」而不是一堆点 */
  if (id === 'stars90') {
    const d = [[4.8, 8.6], [8.2, 6.0], [11.6, 7.2], [14.2, 10.0], [14.8, 14.2], [19.0, 17.2], [13.4, 18.8]];
    let dots = '';
    for (let i = 0; i < d.length; i++) {
      dots += `  <circle cx="${d[i][0]}" cy="${d[i][1]}" r="${i === 6 ? 2.5 : 1.7}" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1"/>\n`;
    }
    return head +
      `  <path d="M${d.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L')}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>\n` +
      dots + tail;
  }
  /* 连锁狂人：同心涟漪 */
  if (id === 'cascade8') {
    return head +
      `  <circle cx="12" cy="12" r="9.6" fill="none" stroke="${CINNABAR}" stroke-width="1.4" opacity="0.42"/>\n` +
      `  <circle cx="12" cy="12" r="6.4" fill="none" stroke="${CINNABAR}" stroke-width="1.8" opacity="0.8"/>\n` +
      `  <circle cx="12" cy="12" r="3.0" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1.1"/>\n` + tail;
  }
  /* 风起云涌：卷云 + 朱砂核（引爆特殊块） */
  if (id === 'specials100') {
    return head +
      `  <path d="M12 12 a1.8 1.8 0 0 1 1.8 1.8 a3.8 3.8 0 0 1 -3.8 3.8 a6.0 6.0 0 0 1 -6.0 -6.0 a8.4 8.4 0 0 1 8.4 -8.4"
     fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round"/>\n` +
      `  <circle cx="12" cy="12" r="2.2" fill="${CINNABAR}"/>\n` + tail;
  }
  /* 破障高手：石锁被敲掉一角 + 碎屑飞散
   * 沿用障碍「石环 + 四角铆钉」的视觉语言，右下角换成锯齿缺口——
   * 玩家一眼认出是「破掉的那种东西」，而不是一块普通石头。 */
  if (id === 'obst200') {
    return head +
      `  <path d="M4.6 4.4 h14.8 v7.4 l-3.2 3.0 -4.0 -1.4 -2.4 3.4 -5.2 -2.6 z"
     fill="${STONE}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>\n` +
      `  <path d="M7.2 5.6 v12.0" fill="none" stroke="#FFFFFF" stroke-width="1.0" opacity="0.5"/>\n` +
      `  <circle cx="8.2" cy="8.2" r="1.35" fill="#E2DCD0" stroke="${INK}" stroke-width="0.85"/>\n` +
      `  <circle cx="15.8" cy="8.2" r="1.35" fill="#E2DCD0" stroke="${INK}" stroke-width="0.85"/>\n` +
      `  <g fill="none" stroke="${CINNABAR}" stroke-width="1.9" stroke-linecap="round">\n` +
      `    <path d="M19.6 3.4 l2.2 -1.6"/>\n` +
      `    <path d="M21.0 8.0 l2.4 0.2"/>\n` +
      `    <path d="M18.4 12.2 l2.0 2.0"/>\n` +
      `  </g>\n` + tail;
  }
  /* 日行一善：日历 + 朱砂点 */
  if (id === 'daily7') {
    return head +
      `  <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2" fill="#FBF6EA" stroke="${INK}" stroke-width="1.8"/>\n` +
      `  <path d="M3.4 10.0 h17.2" fill="none" stroke="${INK}" stroke-width="1.6"/>\n` +
      `  <path d="M8.2 3.2 v3.6" fill="none" stroke="${GOLD}" stroke-width="2.1" stroke-linecap="round"/>\n` +
      `  <path d="M15.8 3.2 v3.6" fill="none" stroke="${GOLD}" stroke-width="2.1" stroke-linecap="round"/>\n` +
      `  <circle cx="12" cy="15.6" r="2.7" fill="${CINNABAR}"/>\n` + tail;
  }
  /* 坚持不懈：七日珠串（第七颗描金） */
  if (id === 'streak7') {
    let beads = '';
    for (let i = 0; i < 7; i++) {
      const y = 3.6 + i * 2.85;
      const last = i === 6;
      beads += `  <circle cx="12" cy="${y.toFixed(2)}" r="${last ? 2.4 : 2.0}" fill="${last ? GOLD_HI : '#FBF6EA'}" stroke="${last ? '#8A5F18' : INK}" stroke-width="${last ? 1.2 : 1.5}"/>\n`;
    }
    return head +
      `  <path d="M12 1.2 v21.6" fill="none" stroke="${INK}" stroke-width="1.1" opacity="0.32"/>\n` +
      beads + tail;
  }
  /* 无尽旅人：远山 + 山径 + 日 */
  if (id === 'endless10') {
    return head +
      `  <path d="M3.0 15.6 l4.6 -6.4 3.2 4.2 2.6 -3.4 4.8 5.6" fill="none" stroke="${INK}" stroke-width="2.0" stroke-linejoin="round" stroke-linecap="round"/>\n` +
      `  <path d="M2.8 21.0 c3.6 0 4.6 -1.8 7.4 -1.8 c3.0 0 3.6 1.8 6.8 1.8 c1.5 0 2.6 -0.5 3.6 -1.2"
     fill="none" stroke="${CINNABAR}" stroke-width="2.0" stroke-linecap="round"/>\n` +
      `  <circle cx="17.8" cy="5.4" r="2.7" fill="${GOLD_HI}" stroke="#8A5F18" stroke-width="1"/>\n` + tail;
  }
  /* 疾风快手：沙漏 */
  return head +
    `  <path d="M6.2 2.8 h11.6 v3.4 c0 2.6 -3.4 3.4 -3.4 5.8 c0 2.4 3.4 3.2 3.4 5.8 v3.4 h-11.6 v-3.4 c0 -2.6 3.4 -3.4 3.4 -5.8 c0 -2.4 -3.4 -3.2 -3.4 -5.8 z"
     fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>\n` +
    `  <path d="M8.6 5.2 h6.8 c0 1.9 -2.5 2.5 -2.5 4.4 c0 1.9 2.5 2.5 2.5 4.4 h-6.8 c0 -1.9 2.5 -2.5 2.5 -4.4 c0 -1.9 -2.5 -2.5 -2.5 -4.4 z"
     fill="${GOLD_HI}" opacity="0.6"/>\n` +
    `  <path d="M4.4 21.2 h15.2" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>\n` + tail;
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

/* 画卷：5 层水墨，按累计星数逐层显现（远山 → 中景 → 近山 → 松林 → 明月归鸟） */
function scrollLayer(n) {
  const S = (d, extra) => `<path d="${d}" ${extra || ''}/>`;
  const layers = {
    1: `<g opacity="0.30" fill="#7E9A82">${S('M0 150 L40 108 L74 138 L116 92 L158 134 L196 104 L238 140 L282 112 L320 146 L320 200 L0 200 Z')}</g>`,
    2: `<g opacity="0.42" fill="#4A6B52">${S('M0 172 L36 132 L70 158 L110 118 L150 156 L190 126 L232 160 L276 130 L320 166 L320 200 L0 200 Z')}</g>`,
    3: `<g opacity="0.55" fill="#2F4A3A">${S('M0 196 L44 160 L86 184 L130 146 L176 186 L220 158 L266 188 L320 164 L320 200 L0 200 Z')}</g>`,
    4: `<g opacity="0.75" fill="#22382C">
      ${S('M28 200 L28 176 L22 182 L28 170 L34 182 L28 176 Z')}
      ${S('M44 200 L44 168 L36 176 L44 160 L52 176 L44 168 Z')}
      ${S('M58 200 L58 180 L52 186 L58 174 L64 186 L58 180 Z')}
      ${S('M262 200 L262 170 L254 178 L262 162 L270 178 L262 170 Z')}
      ${S('M278 200 L278 182 L272 188 L278 176 L284 188 L278 182 Z')}
      ${S('M292 200 L292 172 L284 180 L292 164 L300 180 L292 172 Z')}
      <rect x="20" y="196" width="300" height="4" rx="2"/>
    </g>`,
    5: `<g opacity="0.85">
      <circle cx="256" cy="52" r="18" fill="none" stroke="#8A6A3A" stroke-width="1.6"/>
      <path d="M250 46 a8 8 0 0 0 0 12 a10 10 0 0 1 0 -12" fill="#8A6A3A" opacity="0.5"/>
      <g fill="none" stroke="#3A3226" stroke-width="1.3" stroke-linecap="round" opacity="0.8">
        <path d="M96 62 q6 -5 12 0 q6 -5 12 0"/>
        <path d="M132 48 q5 -4 10 0 q5 -4 10 0"/>
        <path d="M70 84 q5 -4 10 0"/>
      </g>
      <g opacity="0.85">
        <path d="M172 200 L172 176 L166 182 L172 168 L178 182 L172 176 Z" fill="#22382C"/>
        <path d="M164 176 q8 -14 16 0 q-8 -6 -16 0" fill="#2F4A3A"/>
        <path d="M186 200 L186 180 L181 185 L186 173 L191 185 L186 180 Z" fill="#22382C"/>
        <path d="M180 182 q7 -12 14 0 q-7 -5 -14 0" fill="#2F4A3A"/>
      </g>
    </g>`
  };
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">${layers[n] || ''}</svg>
`;
}

/* 成就徽记：一枚描金云纹牌 */
function iconMedal() {
  return HEAD + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <circle cx="12" cy="10" r="7.5" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <circle cx="12" cy="10" r="4.4" fill="rgba(201,162,39,0.22)" stroke="${GOLD}" stroke-width="1"/>
  <path d="M8.5 16.5 L6.5 22 L12 19.5 L17.5 22 L15.5 16.5" fill="${CINNABAR}" opacity="0.85"/>
</svg>
`;
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
  'ui_skill_hammer.svg': iconSkill('hammer'),
  'ui_skill_swap.svg': iconSkill('swap'),
  'ui_skill_color.svg': iconSkill('color'),
  'ui_skill_cross.svg': iconSkill('cross'),
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
  'scroll_l1.svg': scrollLayer(1),
  'scroll_l2.svg': scrollLayer(2),
  'scroll_l3.svg': scrollLayer(3),
  'scroll_l4.svg': scrollLayer(4),
  'scroll_l5.svg': scrollLayer(5),
  'ui_medal.svg': iconMedal(),
  'board_frame.svg': boardFrame(),
  /* 成就徽记：与 Achievements.LIST 的 id 一一对应 */
  'ach_firstStar.svg': iconAch('firstStar'),
  'ach_stars10.svg': iconAch('stars10'),
  'ach_stars30.svg': iconAch('stars30'),
  'ach_stars60.svg': iconAch('stars60'),
  'ach_stars90.svg': iconAch('stars90'),
  'ach_cascade8.svg': iconAch('cascade8'),
  'ach_specials100.svg': iconAch('specials100'),
  'ach_obst200.svg': iconAch('obst200'),
  'ach_daily7.svg': iconAch('daily7'),
  'ach_streak7.svg': iconAch('streak7'),
  'ach_endless10.svg': iconAch('endless10'),
  'ach_timed8k.svg': iconAch('timed8k')
};

let bytes = 0;
for (const name in files) {
  const svg = files[name];
  writeFileSync(join(OUT, name), svg, 'utf8');
  bytes += Buffer.byteLength(svg, 'utf8');
}
console.log('生成 ' + Object.keys(files).length + ' 个 SVG，共 ' + (bytes / 1024).toFixed(1) + ' KB → ' + OUT);
