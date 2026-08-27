// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import redirects from './src/data/redirects.json';

// 旧 URL → 新 URL 的 301 映射（由 WXR × GSC × Ahrefs 三源合并生成）
// astro build 时写入 _redirects；Cloudflare Pages 原生解析为 301。
export default defineConfig({
  site: 'https://aerogela.com',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  redirects,
  build: {
    format: 'directory',
  },
  output: 'static',
});