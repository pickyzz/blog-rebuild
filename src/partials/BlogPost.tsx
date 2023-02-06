import type { ReactNode } from 'react';

import type { BlogFrontmatter } from '@/components';
import { PostContent, PostHeader, Section } from '@/components';
import { AppConfig } from '@/utils/AppConfig';

type IBlogPostProps = {
  frontmatter: BlogFrontmatter;
  children: ReactNode;
};

const BlogPost = (props: IBlogPostProps) => (
  <Section>
    <PostHeader content={props.frontmatter} author={AppConfig.author} />

    <PostContent content={props.frontmatter}>{props.children}</PostContent>
  </Section>
);

export { BlogPost };
