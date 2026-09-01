#!/usr/bin/env node
/**
 * 构建后向 dist/_redirects 追加旧 sitemap 的 301 规则。
 *
 * 背景:Astro 的 redirects 配置对带扩展名的路径(/sitemap.xml)不会写入 _redirects,
 * 而 Bing 后台仍保留 WP 时代旧 sitemap 条目(/sitemap.xml、/sitemap_index.xml,
 * 各 308 个旧 URL 且无法手动删除,菜单仅 Re-submit)。
 * 将其 301 到新 /sitemap-index.xml 后,Bing 下次抓取直接拿到 222 条新清单,
 * 立即停止按旧清单抓取死链(优于等待 404 自然淘汰)。
 */
import { appendFileSync, readFileSync } from 'node:fs';

const FILE = new URL('../dist/_redirects', import.meta.url);
const block = `
# 旧 sitemap(WP/Yoast)301 到新 sitemap:Bing 后台残留条目加速收敛
/sitemap.xml  /sitemap-index.xml  301
/sitemap.xml/  /sitemap-index.xml  301
/sitemap_index.xml  /sitemap-index.xml  301
/sitemap_index.xml/  /sitemap-index.xml  301
`;

const cur = readFileSync(FILE, 'utf8');
if (cur.includes('/sitemap.xml  /sitemap-index.xml')) {
  console.log('[sitemap-redirects] 规则已存在,跳过');
} else {
  appendFileSync(FILE, block);
  console.log('[sitemap-redirects] 已追加 4 条旧 sitemap 301 规则');
}
