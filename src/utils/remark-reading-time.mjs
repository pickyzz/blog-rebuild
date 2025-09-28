import getReadingTime from "reading-time";
import { toString } from "mdast-util-to-string";

/**
 * A remark plugin that adds a `readingTime` field to the frontmatter.
 *
 * The reading time is calculated based on the text content of the page.
 *
 * @return {import('unified').Plugin<[], import('mdast').Root>} A unified plugin
 */
export function remarkReadingTime() {
  return function (tree, vfile) {
    try {
      const textOnPage = toString(tree) || "";
      const readingTime = getReadingTime(textOnPage);

      // Ensure vfile.data and frontmatter objects exist
      if (!vfile || typeof vfile !== "object") return;
      vfile.data = vfile.data || {};
      vfile.data.astro = vfile.data.astro || {};
      vfile.data.astro.frontmatter = vfile.data.astro.frontmatter || {};

      vfile.data.astro.frontmatter.readingTime = readingTime?.text ?? null;
    } catch (err) {
      // swallow errors to avoid breaking build; log minimal info if available
      // console.warn is safe in build-time plugins
       
      console.warn("[remark-reading-time] failed to compute reading time:", err?.message ?? err);
    }
  };
}