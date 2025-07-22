import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /drafts/
Disallow: /*.json$
Disallow: /*?*
Crawl-delay: 10

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Google-Extended
Disallow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  return new Response(getRobotsTxt(sitemapURL));
};
