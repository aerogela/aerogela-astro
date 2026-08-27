// 生成全站默认 OG 图(1200x630) — 首页/供应商页/分类页等无专属图的页面共用
// 设计语言与 gen-heroes.mjs 一致:纸底、细网格、青色叠层方块、琥珀点缀
// 用法: node scripts/gen-og-default.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/og-default.png');

const C = {
  paper: '#f4f3ee', ink: '#131b26', muted: '#67717e',
  line: '#e3e1d6', teal: '#0d7684', tealDeep: '#0a5a64',
  amber: '#e07b1f', white: '#ffffff',
};
const W = 1200, H = 630;

// 与 Base.astro 品牌 SVG 同构的叠层方块(气凝胶纳米孔隐喻)
const cx = 940, cy = 315;
const layers = [
  { w: 200, h: 200, dx: -105, dy: 105, rot: -4, fill: C.teal, op: 0.14 },
  { w: 240, h: 240, dx: -55, dy: 55, rot: -2, fill: C.teal, op: 0.24 },
  { w: 285, h: 285, dx: 0, dy: 0, rot: 1.5, fill: C.tealDeep, op: 0.42 },
  { w: 330, h: 330, dx: 55, dy: -55, rot: -1, fill: C.teal, op: 0.72 },
  { w: 375, h: 375, dx: 105, dy: -105, rot: 3, fill: C.teal, op: 0.94 },
];
const rects = layers.map((l) =>
  `<rect x="${cx + l.dx - l.w / 2}" y="${cy + l.dy - l.h / 2}" width="${l.w}" height="${l.h}" rx="30" transform="rotate(${l.rot} ${cx} ${cy})" fill="${l.fill}" opacity="${l.op}"/>`
);

// 最上层实心方块上开"孔洞"
const pores = [
  [cx - 90, cy + 40, 7], [cx - 30, cy - 70, 5], [cx + 40, cy + 85, 8],
  [cx + 100, cy - 25, 6], [cx - 60, cy + 110, 5], [cx + 70, cy + 30, 4],
  [cx + 10, cy + 60, 6], [cx - 110, cy - 40, 5], [cx + 130, cy + 60, 7],
  [cx - 20, cy - 120, 4], [cx + 85, cy - 95, 5], [cx - 140, cy + 80, 6],
].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.paper}" opacity="0.5"/>`);

let grid = '';
for (let x = 40; x < W; x += 40) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
for (let y = 40; y < H; y += 40) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <g stroke="${C.line}" stroke-width="1" opacity="0.55">${grid}</g>
  <rect x="0" y="0" width="${W}" height="6" fill="${C.teal}"/>
  ${rects.join('\n  ')}
  ${pores.join('')}
  <rect x="790" y="112" width="30" height="30" rx="8" fill="${C.amber}"/>
  <g>
    <rect x="84" y="150" width="34" height="4" rx="2" fill="${C.amber}"/>
    <text x="130" y="158" font-family="IBM Plex Mono" font-size="19" letter-spacing="4" fill="${C.tealDeep}">AEROGELA / SUPPLIER DIRECTORY</text>
  </g>
  <text x="84" y="268" font-family="Bricolage Grotesque 96pt ExtraBold" font-size="96" fill="${C.ink}">aerogela</text>
  <text x="84" y="330" font-family="Archivo" font-size="30" fill="${C.muted}">The aerogel industry directory — manufacturers,</text>
  <text x="84" y="372" font-family="Archivo" font-size="30" fill="${C.muted}">suppliers, and equipment, verified worldwide.</text>
  <g>
    <line x1="84" y1="540" x2="152" y2="540" stroke="${C.teal}" stroke-width="3"/>
    <text x="84" y="576" font-family="IBM Plex Mono" font-size="17" letter-spacing="2" fill="${C.muted}">133 VERIFIED LISTINGS — 35 TECHNICAL GUIDES</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg), { density: 144 })
  .resize(W, H)
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(OUT);

const stat = (await import('node:fs')).statSync(OUT);
console.log(`生成 ${OUT} (${(stat.size / 1024).toFixed(1)} KB)`);
