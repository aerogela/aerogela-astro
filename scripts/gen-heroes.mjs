// 生成博客文章 hero 图(OG PNG + 页面 WebP)
// 设计语言:工业数据表 — 纸底、细网格、主题化图案、琥珀点缀
// 差异化策略:每篇文章按 slug 分类到主题桶(采购/制造/电池/防火/低温/航天/管道/建筑/对比/区域/应用/基础),
//            每桶有独立几何图案 + 主题色 + 页脚标签,保留统一版式但每张图可辨识
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
  // 主题扩展色(保持低饱和工业感)
  green: '#4a7c59', rust: '#a63d2a', ice: '#4d7fa8',
  slate: '#55617a', clay: '#9c6b4f', mutedLight: '#9aa3ad',
};

const W = 1200, H = 630;

// --- 主题桶:先匹配先得 ---
const TOPICS = [
  { key: 'commerce',      re: /price|how-to-buy|how-to-choose/,             label: 'PROCUREMENT GUIDE', accent: C.amber },
  { key: 'manufacturing', re: /are-made|supercritical-drying/,              label: 'MANUFACTURING',     accent: C.tealDeep },
  { key: 'ev',            re: /ev-battery/,                                 label: 'EV & BATTERY',      accent: C.green },
  { key: 'fire',          re: /fire/,                                       label: 'FIRE SAFETY',       accent: C.rust },
  { key: 'cryo',          re: /cryogenic|cold-chain/,                       label: 'CRYOGENICS',        accent: C.ice },
  { key: 'space',         re: /spacecraft|research-centers/,                label: 'RESEARCH & SPACE',  accent: C.teal, dark: true },
  { key: 'pipes',         re: /industrial-pipes|cui|subsea/,                label: 'INDUSTRIAL PIPES',  accent: C.slate },
  { key: 'building',      re: /building-retrofit/,                          label: 'BUILDING RETROFIT', accent: C.clay },
  { key: 'compare',       re: /-vs-/,                                       label: 'COMPARISON',        accent: C.slate },
  { key: 'region',        re: /asia-|europe-/,                              label: 'MARKET GUIDE',      accent: C.teal },
  { key: 'blanket',       re: /blanket-applications|blanket-installation/,  label: 'APPLICATIONS',      accent: C.teal },
];
const DEFAULT_TOPIC = { key: 'basics', label: 'TECHNICAL GUIDE', accent: C.teal };
const topicFor = (slug) => TOPICS.find((t) => t.re.test(slug)) || DEFAULT_TOPIC;

// 主题 key -> 图案函数名别名
const MOTIF_ALIAS = {
  commerce: 'chart', manufacturing: 'molecule', ev: 'battery', space: 'orbit',
  building: 'strata', region: 'globe', blanket: 'bands', basics: 'pore',
};

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
const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const fx = (n) => n.toFixed(1);

// --- 图案库:每个主题一个几何构图,绘制在右侧艺术区(约 x 760-1160, y 70-570) ---
const MOTIFS = {
  // 采购:上升柱状图 + 趋势线(价格/报价隐喻)
  chart(rand, t) {
    const bx = 810, by = 520, n = 5 + Math.floor(rand() * 2);
    let bars = '', pts = [];
    for (let i = 0; i < n; i++) {
      const h = 120 + (i / (n - 1)) * 240 + rand() * 60;
      const x = bx + i * 62, w = 38;
      bars += `<rect x="${x}" y="${fx(by - h)}" width="${w}" height="${fx(h)}" rx="7" fill="${t.accent}" opacity="${(0.35 + (i / (n - 1)) * 0.65).toFixed(2)}"/>`;
      pts.push([x + w / 2, by - h - 26]);
    }
    const trend = pts.map((p, i) => `${i ? 'L' : 'M'}${fx(p[0])} ${fx(p[1])}`).join(' ');
    const dots = pts.map((p) => `<circle cx="${fx(p[0])}" cy="${fx(p[1])}" r="5" fill="${C.ink}"/>`).join('');
    return `${bars}<line x1="${bx - 24}" y1="${by}" x2="1150" y2="${by}" stroke="${C.ink}" stroke-width="3"/>` +
      `<path d="${trend}" fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round"/>${dots}`;
  },

  // 制造:分子晶格(溶胶-凝胶化学隐喻)
  molecule(rand, t) {
    const cx = 960, cy = 320, nodes = [];
    const n = 7 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 360 + rand() * 30;
      const r = 90 + rand() * 110;
      const [x, y] = polar(cx, cy, r, ang);
      nodes.push({ x, y, r: 14 + rand() * 20 });
    }
    nodes.push({ x: cx, y: cy, r: 22 });
    let bonds = '';
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < 210) bonds += `<line x1="${fx(nodes[i].x)}" y1="${fx(nodes[i].y)}" x2="${fx(nodes[j].x)}" y2="${fx(nodes[j].y)}" stroke="${t.accent}" stroke-width="2" opacity="0.5"/>`;
      }
    const hotIdx = Math.floor(rand() * (nodes.length - 1));
    const dots = nodes.map((nd, i) =>
      `<circle cx="${fx(nd.x)}" cy="${fx(nd.y)}" r="${fx(nd.r)}" fill="${i === hotIdx ? C.amber : t.accent}" opacity="${i === hotIdx ? 1 : 0.78}"/>`
    ).join('');
    return bonds + dots;
  },

  // 电池:电芯阵列 + 热失控单体(琥珀)
  battery(rand, t) {
    const n = 4, cw = 64, gap = 26, x0 = 780 + Math.floor(rand() * 40), y0 = 185 + Math.floor(rand() * 30), ch = 300;
    const hot = 1 + Math.floor(rand() * (n - 1));
    let out = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (cw + gap), isHot = i === hot;
      out += `<rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="14" fill="${isHot ? C.amber : t.accent}" opacity="${isHot ? 0.95 : 0.30}" stroke="${isHot ? C.amber : t.accent}" stroke-width="3.5"/>`;
      out += `<rect x="${x + cw / 2 - 12}" y="${y0 - 18}" width="24" height="16" rx="4" fill="${isHot ? C.amber : t.accent}"/>`;
      if (!isHot) out += `<line x1="${x + 14}" y1="${y0 + ch / 2}" x2="${x + cw - 14}" y2="${y0 + ch / 2}" stroke="${t.accent}" stroke-width="3" opacity="0.55"/>`;
    }
    return out;
  },

  // 防火:同心防护盾 + 中心火苗
  fire(rand, t) {
    const cx = 950, cy = 330;
    const shield = (s, op, fill) => {
      const w = s, h = s * 1.18, x = cx - w / 2, y = cy - h / 2;
      return `<rect x="${fx(x)}" y="${fx(y)}" width="${fx(w)}" height="${fx(h)}" rx="${fx(s * 0.24)}" fill="${fill}" opacity="${op}" transform="rotate(${(rand() * 6 - 3).toFixed(1)} ${cx} ${cy})"/>`;
    };
    const flame = `<path d="M ${cx} ${cy - 88} C ${cx + 46} ${cy - 30} ${cx + 38} ${cy + 30} ${cx} ${cy + 62} C ${cx - 38} ${cy + 30} ${cx - 46} ${cy - 30} ${cx} ${cy - 88} Z" fill="${C.amber}"/>`;
    return shield(330, 0.16, t.accent) + shield(258, 0.3, t.accent) + shield(186, 0.55, t.accent) + flame;
  },

  // 低温:同心温度环 + 辐射刻度 + 雪晶(半透明填充增强视觉重量)
  cryo(rand, t) {
    const cx = 950 + Math.floor((rand() - 0.5) * 60), cy = 320 + Math.floor((rand() - 0.5) * 40);
    let out = '';
    const rings = [170, 128, 86, 44];
    rings.forEach((r, i) => {
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.accent}" opacity="${(0.10 + i * 0.07).toFixed(2)}"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.accent}" stroke-width="${4.5 - i * 0.6}" opacity="${0.95 - i * 0.12}"/>`;
    });
    out += `<circle cx="${cx}" cy="${cy}" r="16" fill="${C.amber}"/>`;
    for (let i = 0; i < 16; i++) {
      const a = i * 22.5 + rand() * 6;
      const [x1, y1] = polar(cx, cy, 182, a), [x2, y2] = polar(cx, cy, 204, a);
      out += `<line x1="${fx(x1)}" y1="${fx(y1)}" x2="${fx(x2)}" y2="${fx(y2)}" stroke="${t.accent}" stroke-width="3.5" opacity="0.75"/>`;
    }
    // 雪晶(六臂)
    const snow = (sx, sy, s) => {
      let arms = '';
      for (let i = 0; i < 6; i++) {
        const a = i * 60, [ex, ey] = polar(sx, sy, s, a);
        arms += `<line x1="${sx}" y1="${sy}" x2="${fx(ex)}" y2="${fx(ey)}" stroke="${t.accent}" stroke-width="3.5" opacity="0.9"/>`;
      }
      return arms + `<circle cx="${sx}" cy="${sy}" r="5" fill="${C.amber}"/>`;
    };
    out += snow(1130, 140, 28) + snow(790, 510, 22) + snow(1110, 525, 17);
    return out;
  },

  // 航天/科研(深色底):行星 + 轨道 + 星点
  orbit(rand, t) {
    const cx = 980, cy = 400;
    let out = `<circle cx="${cx}" cy="${cy}" r="230" fill="${C.tealDeep}"/><circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="${C.teal}" stroke-width="3" opacity="0.6"/>`;
    // 行星表面纹理弧线
    for (let i = 0; i < 4; i++) {
      const yy = cy - 120 + i * 80 + rand() * 20;
      out += `<path d="M ${cx - 200 + rand() * 60} ${fx(yy)} Q ${cx} ${fx(yy - 26 + rand() * 52)} ${cx + 200 - rand() * 60} ${fx(yy)}" fill="none" stroke="${C.paper}" stroke-width="2" opacity="0.22"/>`;
    }
    // 轨道 + 卫星
    const orbit = (rx, ry, rot, op) => {
      const mAng = rand() * 360, [mx, my] = polar(0, 0, rx, mAng);
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${C.paper}" stroke-width="1.8" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>` +
        `<g transform="rotate(${rot} ${cx} ${cy})"><circle cx="${fx(cx + mx)}" cy="${fx(cy + my * ry / rx)}" r="9" fill="${C.amber}"/></g>`;
    };
    out += orbit(320, 110, -18, 0.5) + orbit(280, 96, 24, 0.38);
    // 星点
    for (let i = 0; i < 14; i++) {
      const sx = 770 + rand() * 400, sy = 80 + rand() * 440;
      if (Math.hypot(sx - cx, sy - cy) < 250) continue;
      out += `<circle cx="${fx(sx)}" cy="${fx(sy)}" r="${(1.2 + rand() * 2).toFixed(1)}" fill="${C.paper}" opacity="${(0.3 + rand() * 0.5).toFixed(2)}"/>`;
    }
    return out;
  },

  // 管道:管道横截面同心环 + 流向虚线
  pipes(rand, t) {
    const cx = 950 + Math.floor((rand() - 0.5) * 60), cy = 300 + Math.floor((rand() - 0.5) * 40);
    let out = '';
    [[150, 0.18], [112, 0.32], [74, 0.55], [36, 0.95]].forEach(([r, op]) => {
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.accent}" opacity="${op}"/>`;
    });
    for (let i = 0; i < 4; i++) {
      const a = 45 + i * 90;
      const [x1, y1] = polar(cx, cy, 160, a), [x2, y2] = polar(cx, cy, 212, a);
      out += `<line x1="${fx(x1)}" y1="${fx(y1)}" x2="${fx(x2)}" y2="${fx(y2)}" stroke="${t.accent}" stroke-width="3.5" opacity="0.55"/>`;
    }
    // 流向虚线 + 箭头
    const fy = 545;
    out += `<line x1="780" y1="${fy}" x2="1090" y2="${fy}" stroke="${C.ink}" stroke-width="3" stroke-dasharray="14 10"/>`;
    out += `<path d="M 1090 ${fy - 10} L 1114 ${fy} L 1090 ${fy + 10} Z" fill="${C.ink}"/>`;
    return out;
  },

  // 建筑:错位砌层(薄保温层隐喻)
  strata(rand, t) {
    let out = '';
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const y = 130 + i * 68;
      const x = 770 + ((i % 2) * 54) + rand() * 24;
      const w = 300 - rand() * 70;
      const isAmber = i === Math.floor(rand() * rows);
      out += `<rect x="${fx(x)}" y="${y}" width="${fx(w)}" height="46" rx="8" fill="${isAmber ? C.amber : t.accent}" opacity="${isAmber ? 0.9 : (0.3 + (i / rows) * 0.5).toFixed(2)}"/>`;
    }
    return out;
  },

  // 对比:双面板 + VS(左半透明填充 + 右实心,增强对比感)
  compare(rand, t) {
    const y = 150 + Math.floor(rand() * 24), h = 320;
    return `<rect x="790" y="${y}" width="150" height="${h}" rx="18" fill="${C.slate}" opacity="0.22" stroke="${C.slate}" stroke-width="3.5" stroke-dasharray="10 8"/>` +
      `<rect x="990" y="${y}" width="150" height="${h}" rx="18" fill="${C.teal}" opacity="0.88"/>` +
      `<text x="965" y="${y + h / 2 + 10}" font-family="IBM Plex Mono" font-size="30" font-weight="bold" fill="${C.ink}" text-anchor="middle">VS</text>` +
      `<circle cx="865" cy="${y + h + 46}" r="7" fill="${C.amber}"/><circle cx="897" cy="${y + h + 46}" r="7" fill="${C.amber}" opacity="0.6"/><circle cx="929" cy="${y + h + 46}" r="7" fill="${C.amber}" opacity="0.3"/>`;
  },

  // 区域市场:半调地球点阵 + 位置标记
  globe(rand, t) {
    const cx = 950 + Math.floor((rand() - 0.5) * 50), cy = 310 + Math.floor((rand() - 0.5) * 36), R = 200;
    let out = '';
    for (let gx = -R; gx <= R; gx += 26) {
      for (let gy = -R; gy <= R; gy += 26) {
        const d = Math.hypot(gx, gy);
        if (d > R) continue;
        // 模拟球面光照:右下偏亮
        const light = 0.3 + ((gx + gy) / (2 * R) + 0.5) * 0.65;
        out += `<circle cx="${cx + gx}" cy="${cy + gy}" r="${(4 + light * 5).toFixed(1)}" fill="${t.accent}" opacity="${light.toFixed(2)}"/>`;
      }
    }
    // 位置标记(琥珀圆点 + 指针)
    const px = cx + 60 + rand() * 50, py = cy - 80 + rand() * 60;
    out += `<circle cx="${fx(px)}" cy="${fx(py)}" r="15" fill="none" stroke="${C.amber}" stroke-width="5"/>` +
      `<circle cx="${fx(px)}" cy="${fx(py)}" r="5" fill="${C.amber}"/>` +
      `<circle cx="1075" cy="138" r="8" fill="${C.amber}" opacity="0.85"/><circle cx="1112" cy="170" r="6" fill="${C.amber}" opacity="0.5"/>`;
    return out;
  },

  // 毯应用:水平层带 + 缝合虚线(气凝胶毯层压隐喻)
  bands(rand, t) {
    let out = '';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = 140 + i * 82;
      const x = 760 + rand() * 50;
      const w = 300 - i * 34 + rand() * 30;
      const isAmber = i === Math.floor(rand() * n);
      out += `<rect x="${fx(x)}" y="${y}" width="${fx(w)}" height="54" rx="10" fill="${isAmber ? C.amber : t.accent}" opacity="${isAmber ? 0.92 : (0.88 - i * 0.13).toFixed(2)}"/>`;
      if (i > 0) out += `<line x1="${fx(x - 14)}" y1="${y - 14}" x2="${fx(x + w + 14)}" y2="${y - 14}" stroke="${C.ink}" stroke-width="2" stroke-dasharray="3 9" opacity="0.45"/>`;
    }
    return out;
  },

  // 基础:logo 式叠层方块 + 纳米孔洞(原构图,品牌锚点)
  pore(rand, t) {
    const layers = 4 + Math.floor(rand() * 3);
    const cx = 950 + (rand() - 0.5) * 60, cy = 315 + (rand() - 0.5) * 40;
    let out = '';
    const opacities = [0.14, 0.24, 0.42, 0.72, 0.94];
    for (let i = 0; i < layers; i++) {
      const tt = i / Math.max(1, layers - 1);
      const w = 190 + tt * 120 + rand() * 24;
      const dx = (tt - 0.5) * 150 + (rand() - 0.5) * 36;
      const dy = (0.5 - tt) * 150 + (rand() - 0.5) * 36;
      const rot = (rand() - 0.5) * 10;
      const fill = i === layers - 1 ? C.teal : (rand() > 0.75 ? C.tealDeep : C.teal);
      const op = i === layers - 1 ? 1 : opacities[i] ?? 0.3;
      out += `<rect x="${fx(cx + dx - w / 2)}" y="${fx(cy + dy - w / 2)}" width="${fx(w)}" height="${fx(w)}" rx="26" transform="rotate(${rot.toFixed(1)} ${fx(cx)} ${fx(cy)})" fill="${fill}" opacity="${op}"/>`;
    }
    const poreCount = 14 + Math.floor(rand() * 10);
    for (let i = 0; i < poreCount; i++) {
      const px = cx + (rand() - 0.5) * 220, py = cy + (rand() - 0.5) * 220, r = 2.5 + rand() * 5;
      out += `<circle cx="${fx(px)}" cy="${fx(py)}" r="${fx(r)}" fill="${C.paper}" opacity="${(0.35 + rand() * 0.4).toFixed(2)}"/>`;
    }
    return out;
  },
};

// --- 文本度量(与原版一致) ---
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
  const topic = topicFor(post.slug);
  const dark = !!topic.dark;

  // 主题化配色令牌
  const T = dark
    ? { bg: C.ink, ink: C.paper, muted: C.mutedLight, line: 'rgba(244,243,238,0.10)', kicker: '#7fc4cf', rule: '#3fa8b8', topBar: C.teal }
    : { bg: C.paper, ink: C.ink, muted: C.muted, line: C.line, kicker: C.tealDeep, rule: C.teal, topBar: topic.accent };

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

  // 主题图案
  const art = MOTIFS[MOTIF_ALIAS[topic.key] || topic.key](rand, topic);

  // 细网格
  let grid = '';
  for (let x = 40; x < W; x += 40) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 40; y < H; y += 40) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;

  const titleStartY = 208;
  const lh = size * 1.14;
  const titleEls = lines
    .map((l, i) => `<text x="84" y="${(titleStartY + i * lh).toFixed(1)}" font-family="Bricolage Grotesque 96pt ExtraBold" font-size="${size}" fill="${T.ink}">${esc(l)}</text>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${T.bg}"/>
  <g stroke="${T.line}" stroke-width="1" opacity="0.55">${grid}</g>
  <rect x="0" y="0" width="${W}" height="6" fill="${T.topBar}"/>
  ${art}
  <g>
    <rect x="84" y="118" width="34" height="4" rx="2" fill="${C.amber}"/>
    <text x="130" y="126" font-family="IBM Plex Mono" font-size="19" letter-spacing="4" fill="${T.kicker}">AEROGELA / KNOWLEDGE BASE</text>
  </g>
  <g>
    ${titleEls}
  </g>
  <g>
    <line x1="84" y1="540" x2="152" y2="540" stroke="${T.rule}" stroke-width="3"/>
    <text x="84" y="576" font-family="IBM Plex Mono" font-size="17" letter-spacing="2" fill="${T.muted}">${esc(topic.label)} — ${esc(date)}</text>
  </g>
</svg>`;
}

// --- 主流程 ---
mkdirSync(OUT, { recursive: true });
const files = readdirSync(POSTS).filter((f) => f.endsWith('.json'));
const dist = {};
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
  dist[topicFor(p.slug).key] = (dist[topicFor(p.slug).key] || 0) + 1;
  n++;
}
console.log(`生成 ${n} 组 hero 图 -> public/heroes/`);
console.log('主题分布:', JSON.stringify(dist));
