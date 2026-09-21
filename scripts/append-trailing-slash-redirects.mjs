#!/usr/bin/env node
/**
 * 构建后向 dist/_redirects 追加"无尾斜杠 → 带尾斜杠 301"规则。
 *
 * 背景(r14 巡检 2026-09-21):Astro directory 构建格式下,Cloudflare Workers
 * 静态资产层对无斜杠访问返回原生 307(临时)重定向。Google 不通过临时重定向
 * 合并索引信号,疑为 GSC"已抓取-尚未编入"桶中 sitemap 新 URL 编入停滞的诱因。
 *
 * 依据:Cloudflare 官方文档——_redirects 规则优先于资产自动重定向
 * ("Redirects are always followed, regardless of whether or not an asset
 * matches the incoming request."),且官方示例本身即含 `/trailing /trailing/ 301`。
 * 限额 2000 静态规则;现有 ~126 + 本脚本全站页面(~222)= ~348,余量充足。
 */
import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const FILE = join(DIST, '_redirects');
const MARK = '# trailing-slash-301 (auto)';

// 递归收集 dist 下所有 index.html 对应的站点路径(带尾斜杠)
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue; // _astro / _headers / _redirects 等非页面
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name === 'index.html') acc.push(p);
  }
  return acc;
}

const pages = walk(DIST)
  .map((f) => '/' + relative(DIST, f).replace(/index\.html$/, ''))
  .filter((p) => p !== '/') // 首页无"无斜杠变体",无需规则
  .sort();

// 与既有 _redirects 源路径冲突者跳过(旧 WP 301 已覆盖,且 Cloudflare 先匹配先生效)
const existing = readFileSync(FILE, 'utf8');
const sources = new Set(
  existing
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/)[0])
);

const rules = [];
let skipped = 0;
for (const p of pages) {
  const noSlash = p.replace(/\/$/, '');
  if (sources.has(noSlash)) {
    skipped++;
    continue;
  }
  sources.add(noSlash);
  rules.push(`${noSlash}  ${p}  301`);
}

if (existing.includes(MARK)) {
  console.log('[trailing-slash-301] 规则块已存在,跳过');
} else if (rules.length === 0) {
  console.log('[trailing-slash-301] 未发现可追加页面,跳过');
} else {
  appendFileSync(FILE, `\n${MARK}\n${rules.join('\n')}\n`);
  console.log(
    `[trailing-slash-301] 已追加 ${rules.length} 条 301 规则(冲突跳过 ${skipped} 条)`
  );
}
