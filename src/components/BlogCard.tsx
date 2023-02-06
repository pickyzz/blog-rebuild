import type { MarkdownInstance } from 'astro';
import { format } from 'date-fns';

import type { BlogFrontmatter } from '@/components';

type IBlogCardProps = {
  instance: MarkdownInstance<BlogFrontmatter>;
};

const BlogCard = (props: IBlogCardProps) => (
  <a className="hover:translate-y-1" href={props.instance.url}>
    <div className="bg-base-300/30 h-full overflow-hidden rounded-md">
      <div className="aspect-w-3 aspect-h-2">
        <img
          className="h-full w-full object-cover object-center"
          src={props.instance.frontmatter.imgSrc}
          alt={props.instance.frontmatter.imgAlt}
          loading="lazy"
        />
      </div>

      <div className="px-3 pt-4 pb-6 text-center">
        <h2 className="h-16 text-xl font-semibold">
          {props.instance.frontmatter.title}
        </h2>

        <div className="line-clamp-3 mt-2 text-sm ">
          {props.instance.frontmatter.description}
        </div>

        <div className="text-primary-focus mt-4 text-center text-xs">
          {format(new Date(props.instance.frontmatter.pubDate), 'LLL d, yyyy')}
        </div>
      </div>
    </div>
  </a>
);

export { BlogCard };
