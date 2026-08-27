// 生成博客文章统一风格的 hero 图(OG PNG + 页面 WebP)
// 设计语言:工业数据表 — 纸底、细网格、青色叠层方块(气凝胶纳米孔隐喻)、琥珀点缀
// 用法: node scripts/gen-heroes.mjs
// 依赖: sharp + 系统安装的 Bricolage Grotesque / IBM Plex Mono 字体(fontconfig)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const POSTS = join(ROOT, 'src/content/posts');
const OUT = join(ROOT, 'public/heroes');

// 设计令牌(与 src/styles/global.css 一致)
const C = {
  paper: '#f4f3ee', ink: '#131b26', muted: '#67717e',
  line: '#e3e1d6', teal: '#0d7684', tealDeep: '#0a5a64',
  tealWash: '#e6f2f2', amber: '#e07b1f', white: '#ffffff',
};

const W = 1200, H = 630;

// --- 确定性随机(同一 slug 永远生成同一构图) ---
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 粗略字宽估算(Bricolage ExtraBold 混合大小写)
function textWidth(s, size) {
  let w = 0;
  for (const ch of s) {
    if (/[ iljtf.,:;'|!()\[\]]/.test(ch)) w += 0.30;
    else if (/[mwMW]/.test(ch)) w += 0.88;
    else if (/[A-Z]/.test(ch)) w += 0.62;
    else w += 0.52;
  }
  return w * size;
}

function wrap(title, size, maxW, maxLines) {
  const words = title.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (textWidth(cand, size) <= maxW || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // 超行则截断加省略号
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    const rest = words.slice(words.indexOf(lines[maxLines - 1].split(' ')[0]) + last.split(' ').length);
    if (rest.length) {
      while (textWidth(last + '…', size) > maxW) last = last.replace(/\s?\S+$/, '');
      lines[maxLines - 1] = last.replace(/[.,:;]$/, '') + '…';
    }
  }
  return lines;
}

// --- 构图 ---
function svgFor(post) {
  const rand = mulberry32(hashStr(post.slug));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // 标题排版:从大到小试探,最多 3 行
  const maxW = 660;
  let size = 60, lines;
  for (const s of [60, 55, 50, 46, 42, 38, 34]) {
    size = s;
    lines = wrap(post.title, s, maxW, 3);
    if (lines.every((l) => textWidth(l, s) <= maxW) && lines.length <= 3) break;
  }

  // 日期统一为紧凑格式 2026.08.27(兼容 ISO 与 RFC 两种输入)
  const d = new Date(post.date || '');
  const date = isNaN(d.getTime())
    ? (post.date || '').replace(/-/g, '.')
    : `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;

  // 右侧艺术区:logo 式叠层方块(青色系,不同透明度)
  const layers = 4 + Math.floor(rand() * 3); // 4-6 层
  const cx = 950 + (rand() - 0.5) * 60, cy = 315 + (rand() - 0.5) * 40;
  const rects = [];
  const opacities = [0.14, 0.24, 0.42, 0.72, 0.94];
  for (let i = 0; i < layers; i++) {
    const t = i / Math.max(1, layers - 1);
    const w = 190 + t * 120 + rand() * 24;
    const h = 190 + t * 120 + rand() * 24;
    const dx = (t - 0.5) * 150 + (rand() - 0.5) * 36;
    const dy = (0.5 - t) * 150 + (rand() - 0.5) * 36;
    const rot = (rand() - 0.5) * 10;
    const fill = i === layers - 1 ? C.teal : (rand() > 0.75 ? C.tealDeep : C.teal);
    const op = i === layers - 1 ? 1 : opacities[i] ?? 0.3;
    rects.push(`<rect x="${(cx + dx - w / 2).toFixed(1)}" y="${(cy + dy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="26" transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${fill}" opacity="${op}"/>`);
  }

  // 最上层实心方块上开"孔洞"(气凝胶多孔结构隐喻)
  const poreDots = [];
  const poreCount = 14 + Math.floor(rand() * 10);
  for (let i = 0; i < poreCount; i++) {
    const px = cx + (rand() - 0.5) * 220;
    const py = cy + (rand() - 0.5) * 220;
    const r = 2.5 + rand() * 5;
    poreDots.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${C.paper}" opacity="${(0.35 + rand() * 0.4).toFixed(2)}"/>`);
  }

  // 琥珀点缀
  const acc = pick(['sq', 'bar', 'dot']);
  const ax = cx + 130 + rand() * 60, ay = cy - 140 - rand() * 40;
  const amberEl =
    acc === 'sq' ? `<rect x="${ax}" y="${ay}" width="26" height="26" rx="7" fill="${C.amber}"/>` :
    acc === 'bar' ? `<rect x="${ax}" y="${ay}" width="64" height="10" rx="5" fill="${C.amber}"/>` :
    `<circle cx="${ax + 12}" cy="${ay + 12}" r="9" fill="${C.amber}"/>`;

  // 细网格
  let grid = '';
  for (let x = 40; x < W; x += 40) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 40; y < H; y += 40) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;

  const titleStartY = 208;
  const lh = size * 1.14;
  const titleEls = lines
    .map((l, i) => `<text x="84" y="${(titleStartY + i * lh).toFixed(1)}" font-family="Bricolage Grotesque 96pt ExtraBold" font-size="${size}" fill="${C.ink}">${esc(l)}</text>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <g stroke="${C.line}" stroke-width="1" opacity="0.55">${grid}</g>
  <rect x="0" y="0" width="${W}" height="6" fill="${C.teal}"/>
  ${rects.join('\n  ')}
  ${poreDots.join('')}
  ${amberEl}
  <g>
    <rect x="84" y="118" width="34" height="4" rx="2" fill="${C.amber}"/>
    <text x="130" y="126" font-family="IBM Plex Mono" font-size="19" letter-spacing="4" fill="${C.tealDeep}">AEROGELA / KNOWLEDGE BASE</text>
  </g>
  <g>
    ${titleEls}
  </g>
  <g>
    <line x1="84" y1="540" x2="152" y2="540" stroke="${C.teal}" stroke-width="3"/>
    <text x="84" y="576" font-family="IBM Plex Mono" font-size="17" letter-spacing="2" fill="${C.muted}">TECHNICAL GUIDE — ${esc(date)}</text>
  </g>
</svg>`;
}

// --- 主流程 ---
mkdirSync(OUT, { recursive: true });
const files = readdirSync(POSTS).filter((f) => f.endsWith('.json'));
let n = 0;
for (const f of files) {
  const p = JSON.parse(readFileSync(join(POSTS, f), 'utf8'));
  const svg = svgFor(p);
  const png = Buffer.from(svg);
  // 2x 超采样渲染再缩到目标尺寸,文字边缘更平滑
  await sharp(png, { density: 144 })
    .resize(W, H)
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(join(OUT, `${p.slug}.png`));
  await sharp(png, { density: 144 })
    .resize(W, H)
    .webp({ quality: 82 })
    .toFile(join(OUT, `${p.slug}.webp`));
  p.hero = `/heroes/${p.slug}`;
  writeFileSync(join(POSTS, f), JSON.stringify(p, null, 2) + '\n');
  n++;
}
console.log(`生成 ${n} 组 hero 图 -> public/heroes/`);
