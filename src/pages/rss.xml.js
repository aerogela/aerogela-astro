// RSS 2.0 订阅源 — 博客文章(知识库)
// 保留 WP 时代订阅者:旧 /feed/ 已 301 到本端点(见 redirects.json)
import { getCollection } from 'astro:content';
import { SITE, htmlToText } from '../lib/seo';

export async function GET() {
  const posts = (await getCollection('posts'))
    .sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''))
    .slice(0, 50);

  const items = posts.map((p) => {
    const d = p.data;
    const link = `${SITE.domain}/blog/${d.slug}/`;
    // 摘要优先;无摘要时取正文前 300 字符纯文本
    const desc = d.excerpt || htmlToText(d.content, 300);
    const pub = d.date ? new Date(d.date).toUTCString() : new Date().toUTCString();
    return `    <item>
      <title><![CDATA[${d.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${desc}]]></description>
      <pubDate>${pub}</pubDate>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.title}</title>
    <link>${SITE.domain}/</link>
    <description>${SITE.description}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE.domain}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
