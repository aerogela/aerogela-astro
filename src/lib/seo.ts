// SEO 工具：站点元数据 + JSON-LD 生成
export const SITE = {
  name: 'aerogela',
  title: 'aerogela — Aerogel Manufacturer & Supplier Directory',
  domain: 'https://aerogela.com',
  description:
    'Global directory of aerogel manufacturers, suppliers and distributors. Verified aerogel blankets, silica aerogel, and insulation companies worldwide.',
};

/** 简洁标题：解决 WP 后缀冗长导致的截断问题。
 *  超长标题(常见于博客,100+ 字符)在 SERP 被硬截断,
 *  这里按词边界截到 ~59 字符,保留 " | aerogela" 后缀完整。 */
export function pageTitle(t?: string): string {
  if (!t || t === SITE.name) return SITE.title;
  const suffix = ' | aerogela';
  const budget = 70 - suffix.length;
  if (t.length <= budget) return `${t}${suffix}`;
  let cut = t.slice(0, budget);
  const sp = cut.lastIndexOf(' ');
  if (sp > budget * 0.6) cut = cut.slice(0, sp); // 词边界安全截断
  return `${cut.replace(/[\s,;:.\-–—]+$/, '')}${suffix}`;
}

/** 绝对 canonical */
export function canonical(path: string): string {
  const p = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  return `${SITE.domain}${p}`;
}

/** 从 HTML 提取纯文本（用于描述 fallback） */
export function htmlToText(html: string, max = 160): string {
  const t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Organization schema */
export function orgSchema() {
  return {
    '@type': 'Organization',
    '@id': `${SITE.domain}/#org`,
    name: SITE.name,
    url: SITE.domain,
    description: SITE.description,
  };
}

/** WebSite schema（首页） */
export function webSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE.domain}/#website`,
    url: SITE.domain,
    name: SITE.name,
    publisher: { '@id': `${SITE.domain}/#org` },
  };
}

/** Listing → LocalBusiness schema */
export function listingSchema(entry: any, url: string) {
  return {
    '@type': 'Organization',
    '@id': `${url}#listing`,
    name: entry.title,
    url: entry.website || url,
    description: entry.excerpt || htmlToText(entry.content),
    areaServed: entry.location?.[0] ? { '@type': 'Place', name: entry.location[0] } : undefined,
  };
}

/** Article schema */
export function articleSchema(entry: any, url: string) {
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: entry.title,
    description: entry.excerpt || htmlToText(entry.content),
    datePublished: entry.date,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.domain },
    publisher: { '@id': `${SITE.domain}/#org` },
  };
}

/** BreadcrumbList */
export function breadcrumbSchema(crumbs: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}