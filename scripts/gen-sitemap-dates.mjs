#!/usr/bin/env node
/**
 * 生成 sitemap lastmod 日期映射(npm prebuild 自动运行,CI/本地通用):
 * - /listing/{slug}/   ← src/content/listings/{slug}.json 的 git 最后提交时间
 * - /blog/{slug}/      ← src/content/posts/{slug}.json 同上
 * - /listing-category|location/* ← 全部名录中最晚更新时间(聚合页随成员变化)
 * - 其余静态页         ← src/pages/[slug].astro / index.astro 的 git 时间
 * git 不可用时回退文件 mtime;输出 src/data/sitemap-dates.json
 *
 * 浅克隆守卫:CI(Cloudflare Pages)是 shallow clone,git log 只能看到 HEAD,
 * 逐文件时间会全部退化成同一提交时间 → 此时沿用仓库里已提交的日期文件
 * (日期文件由本地全量历史生成并随内容一起提交,CI 不再重新生成)。
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DATES_FILE = 'src/data/sitemap-dates.json';
const hasDates = () => existsSync(join(ROOT, DATES_FILE));

// —— 环境守卫(必须在实际生成逻辑之前)——
// 日期文件由本地全量 git 历史生成并随内容提交;任何无法还原逐文件历史的环境
// (CI 无 .git / 浅克隆)一律沿用入库版本,避免日期退化为同一部署时间。
try {
  execSync('git rev-parse --git-dir', { cwd: ROOT, stdio: 'pipe' });
  const shallow = execSync('git rev-parse --is-shallow-clone', { cwd: ROOT }).toString().trim() === 'true';
  if (shallow && hasDates()) {
    console.log('[sitemap-dates] 浅克隆环境,沿用入库日期文件(CI 不重新生成)');
    process.exit(0);
  }
} catch {
  // 无 .git(CI 源码快照常见):沿用入库版本;仅当从未提交过才回退生成
  if (hasDates()) {
    console.log('[sitemap-dates] 无 git 历史,沿用入库日期文件');
    process.exit(0);
  }
}

const gitDate = (f) => {
  try {
    return execSync(`git log -1 --format=%cI -- ${JSON.stringify(f)}`, { cwd: ROOT, stdio: 'pipe' }).toString().trim() || null;
  } catch { return null; }
};
const fileDate = (f) => { try { return statSync(join(ROOT, f)).toISOString(); } catch { return null; } };
const bestDate = (f) => gitDate(f) || fileDate(f);

const dates = {};
const add = (url, d) => { if (d && (!dates[url] || d > dates[url])) dates[url] = d; };

// 名录与文章:逐文件取真实变更时间
let maxListing = null;
const listingDir = 'src/content/listings';
if (existsSync(join(ROOT, listingDir))) {
  for (const f of readdirSync(join(ROOT, listingDir)).filter((x) => x.endsWith('.json'))) {
    const d = bestDate(`${listingDir}/${f}`);
    add(`/listing/${f.replace(/\.json$/, '')}/`, d);
    if (d && (!maxListing || d > maxListing)) maxListing = d;
  }
}
for (const f of existsSync(join(ROOT, 'src/content/posts'))
  ? readdirSync(join(ROOT, 'src/content/posts')).filter((x) => x.endsWith('.json') || x.endsWith('.md'))
  : []) {
  add(`/blog/${f.replace(/\.(json|md)$/, '')}/`, bestDate(`src/content/posts/${f}`));
}

// 静态内容页(src/content/pages 经 [slug].astro 渲染)
for (const f of existsSync(join(ROOT, 'src/content/pages'))
  ? readdirSync(join(ROOT, 'src/content/pages')).filter((x) => x.endsWith('.json') || x.endsWith('.md'))
  : []) {
  add(`/${f.replace(/\.(json|md)$/, '')}/`, bestDate(`src/content/pages/${f}`));
}

// 静态页与首页:页面源文件的变更时间(含子目录 index.astro → /{dir}/)
const walk = (dir, prefix = '') => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`, `${prefix}${e.name}/`) : [`${dir}/${e.name}`]));
add('/', bestDate('src/pages/index.astro'));
for (const f of walk('src/pages')) {
  if (!f.endsWith('.astro') || f.includes('[')) continue;
  // 'listing/index' → 'listing',顶层 'index' → ''(首页)
  const rel = f.replace(/^src\/pages\//, '').replace(/\.astro$/, '').replace(/\/?index$/, '');
  add(`/${rel}/`, bestDate(f));
}

dates.__max_listings__ = maxListing || new Date().toISOString();
mkdirSync(join(ROOT, 'src/data'), { recursive: true });
writeFileSync(join(ROOT, 'src/data/sitemap-dates.json'), JSON.stringify(dates, null, 0));
console.log(`[sitemap-dates] ${Object.keys(dates).length - 1} 条 URL 日期, 名录最晚更新: ${dates.__max_listings__}`);
