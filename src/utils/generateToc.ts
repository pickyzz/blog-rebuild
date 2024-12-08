// Heavy inspiration from starlight: https://github.com/withastro/starlight/blob/main/packages/starlight/utils/generateToC.ts
import type { MarkdownHeading } from "astro";

export interface TocItem extends MarkdownHeading {
  children: TocItem[];
}

interface TocOpts {
  maxHeadingLevel?: number | undefined;
  minHeadingLevel?: number | undefined;
}

/** Inject a ToC entry as deep in the tree as its `depth` property requires. */
function injectChild(items: TocItem[], item: TocItem): void {
  const lastItem = items.at(-1);
  if (!lastItem || lastItem.depth >= item.depth) {
    items.push(item);
  } else {
    injectChild(lastItem.children, item);
    return;
  }
}

export const generateToc = (
  headings: ReadonlyArray<MarkdownHeading>,
  { maxHeadingLevel = 4, minHeadingLevel = 2 }: TocOpts = {}
) => {
  // กรองเฉพาะ headings ที่มี depth 2 (H2) และ 3 (H3)
  const bodyHeadings = headings.filter(heading => {
    return heading.depth >= minHeadingLevel && heading.depth <= maxHeadingLevel;
  });

  const toc: Array<TocItem> = [];

  for (const heading of bodyHeadings) {
    const tocItem: TocItem = { ...heading, children: [] };
    injectChild(toc, tocItem);
  }

  return toc;
};
