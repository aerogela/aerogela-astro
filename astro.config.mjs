// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import sitemap from '@astrojs/sitemap';
import redirects from './src/data/redirects.json';

// URL → 内容最后变更时间(由 scripts/gen-sitemap-dates.mjs 在 prebuild 生成;缺文件时回退当前时间)
let smDates = {};
try { smDates = JSON.parse(readFileSync(new URL('./src/data/sitemap-dates.json', import.meta.url), 'utf8')); } catch {}
const maxListing = smDates['__max_listings__'] || new Date().toISOString();

// 旧 URL → 新 URL 的 301 映射（由 WXR × GSC × Ahrefs 三源合并生成）
// astro build 时写入 _redirects；Cloudflare Pages 原生解析为 301。
export default defineConfig({
  site: 'https://aerogela.com',
  trailingSlash: 'ignore',
  integrations: [
    // noindex 页面(/search/ 等)不进 sitemap;lastmod 让搜索引擎知道内容更新时间、优先重抓
    sitemap({
      filter: (page) => !page.includes('/search/'),
      serialize: (item) => {
        const path = item.url.replace('https://aerogela.com', '');
        // 聚合页(taxonomy)内容随成员名录变化 → 统一取名录最晚更新时间
        const lastmod = /^\/listing-(category|location)\//.test(path)
          ? maxListing
          : smDates[path] || new Date().toISOString();
        return { ...item, lastmod };
      },
    }),
  ],
  redirects,
  build: {
    format: 'directory',
  },
  output: 'static',
});