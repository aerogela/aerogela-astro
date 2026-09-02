#!/usr/bin/env node
/**
 * IndexNow 主动推送:把新站 URL 批量通知 Bing/Yandex/Naver 等 IndexNow 成员引擎。
 * 用法:
 *   node scripts/indexnow-push.mjs            # 从线上 sitemap-0.xml 拉取全量 URL 推送
 *   node scripts/indexnow-push.mjs u1 u2 ...   # 推送指定 URL
 * key 托管文件 public/{key}.txt 随站点部署,key 值存于 /workspace/.credentials/indexnow.json。
 * 单次上限 10000 URL,本站 222 条一次性推送。
 */
import { readFileSync } from 'node:fs';

const KEY = JSON.parse(readFileSync('/workspace/.credentials/indexnow.json', 'utf8')).indexnow_key;
const HOST = 'aerogela.com';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

let urls;
if (process.argv.length > 2) {
  urls = process.argv.slice(2);
} else {
  const xml = await (await fetch(`https://${HOST}/sitemap-0.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
console.log(`[indexnow] 待推送 ${urls.length} 条 URL,key=${KEY.slice(0, 8)}…`);

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});
console.log(`[indexnow] 响应: HTTP ${res.status} ${res.statusText || ''}`);
if (res.status === 200 || res.status === 202) console.log('[indexnow] ✓ 推送受理(引擎将自行调度抓取)');
else console.log('[indexnow] ✗ 未受理:', (await res.text()).slice(0, 200));
