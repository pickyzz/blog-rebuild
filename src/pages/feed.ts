import rss from '@astrojs/rss';
import { AppConfig } from '@/utils/AppConfig';

export const get = () =>
  rss({
    title: AppConfig.title,
    description: AppConfig.description,
    site: import.meta.env.SITE,
    items: import.meta.glob('./**/*.mdx')
  });
