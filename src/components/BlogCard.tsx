import type { MarkdownInstance } from 'astro';
import { format } from 'date-fns';

import type { IFrontmatter } from '@/components';

type IBlogCardProps = {
  instance: MarkdownInstance<IFrontmatter>;
};

const BlogCard = (props: IBlogCardProps) => (
  <a className="hover:translate-y-1" href={props.instance.url} rel='prefetch'>
    <div className="overflow-hidden rounded-md bg-base-300/50">
      <div className="aspect-w-3 aspect-h-2">
        <img
          className="h-full w-full object-cover object-center"
          src={props.instance.frontmatter.imgSrc}
          alt={props.instance.frontmatter.imgAlt}
          loading="lazy"
        />
      </div>

      <div className="px-3 pt-4 pb-6 text-center">
        <h2 className="text-xl font-semibold">
          {props.instance.frontmatter.title}
        </h2>

        <div className="mt-1 text-xs text-primary-focus">
          {format(new Date(props.instance.frontmatter.pubDate), 'LLL d, yyyy')}
        </div>

        <div className="mt-2 text-sm">
          {props.instance.frontmatter.description}
        </div>
      </div>
    </div>
  </a>
);

export { BlogCard };
