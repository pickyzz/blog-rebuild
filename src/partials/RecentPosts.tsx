import type { MarkdownInstance } from 'astro';

import type { BlogFrontmatter } from '@/components';
import { GradientText, Section } from '@/components';
import { BlogGallery } from '@/components/BlogGallery';

type IRecentPostsProps = {
  postList: MarkdownInstance<BlogFrontmatter>[];
};

const RecentPosts = (props: IRecentPostsProps) => (
  <Section
    title={
      <div className="flex items-baseline justify-between">
        <div>
          Recent <GradientText>Posts</GradientText>
        </div>

        <div className="btn btn-sm btn-ghost text-sm">
          <a href="/blog">View all Posts →</a>
        </div>
      </div>
    }
  >
    <BlogGallery postList={props.postList} />
  </Section>
);

export { RecentPosts };
