import type { FrontmatterPage } from './types/IFrontMatter';

type INewerOlderPaginationProps = {
  page: FrontmatterPage;
};

const NewerOlderPagination = (props: INewerOlderPaginationProps) => (
  <div className="flex justify-center gap-8">
    {props.page.url.prev && <a href={props.page.url.prev} rel='prefetch' className="text-sm btn btn-sm btn-ghost">← Newer Posts</a>}
    {props.page.url.next && <a href={props.page.url.next} rel='prefetch' className="text-sm btn btn-sm btn-ghost">Older Posts →</a>}
  </div>
);

export { NewerOlderPagination };
