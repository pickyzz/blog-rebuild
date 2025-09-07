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

/**
 * Generates a table of contents (ToC) from a list of markdown headings.
 *
 * @param headings - An array of markdown headings to be processed.
 * @param options - An object containing options to specify the minimum and maximum heading levels to include in the ToC.
 * @param options.maxHeadingLevel - The maximum heading level to include in the ToC. Default is 4.
 * @param options.minHeadingLevel - The minimum heading level to include in the ToC. Default is 2.
 * @returns An array of TocItem objects representing the structured ToC.
 */

export const generateToc = (
  headings: ReadonlyArray<MarkdownHeading> | undefined | null,
  { maxHeadingLevel = 4, minHeadingLevel = 2 }: TocOpts = {}
) => {
  // Handle undefined or null headings gracefully
  if (!headings || !Array.isArray(headings)) {
    return [];
  }

  // Filter out headings that are not in the body
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
