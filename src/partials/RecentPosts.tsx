import type { MarkdownInstance } from 'astro';

import type { IFrontmatter } from '@/components';
import { GradientText, Section } from '@/components';
import { BlogGallery } from '@/components/BlogGallery';

type IRecentPostsProps = {
  postList: MarkdownInstance<IFrontmatter>[];
};

const RecentPosts = (props: IRecentPostsProps) => (
  <Section
    title={
      <div className="flex items-baseline justify-between">
        <div>
          Recent <GradientText>Posts</GradientText>
        </div>

        <div className="btn btn-sm btn-ghost text-sm">
          <a href="/blog" rel="noreferrer">
            View all Posts →
          </a>
        </div>
      </div>
    }
  >
    <BlogGallery postList={props.postList} />
  </Section>
);

export { RecentPosts };
