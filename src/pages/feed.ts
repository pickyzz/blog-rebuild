import rss, { pagesGlobToRssItems } from '@astrojs/rss';

import { AppConfig } from '@/utils/AppConfig';

export const get = async () =>
  rss({
    title: AppConfig.title,
    description: AppConfig.description,
    site: import.meta.env.SITE,
    items: await pagesGlobToRssItems(import.meta.glob('./**/*.mdx')),
  });
