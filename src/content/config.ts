import { defineCollection, z } from 'astro:content';

// 迁移自 WordPress WXR：正文以 HTML 原文保留（保真优先，用 set:html 渲染）
const common = {
  slug: z.string(),
  title: z.string(),
  date: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  hero: z.string().optional(),
};

const posts = defineCollection({
  type: 'data',
  schema: z.object(common),
});

const listings = defineCollection({
  type: 'data',
  schema: z.object({
    ...common,
    website: z.string().optional(),
    certifications: z.string().optional(),
    verified: z.string().optional(),
    review_status: z.string().optional(),
    review_notes: z.string().optional(),
    category: z.array(z.string()).default([]),
    location: z.array(z.string()).default([]),
    main_products: z.array(z.string()).default([]),
    application_fields: z.array(z.string()).default([]),
  }),
});

const pages = defineCollection({
  type: 'data',
  schema: z.object({
    ...common,
    parent: z.string().optional(),
  }),
});

export const collections = { posts, listings, pages };