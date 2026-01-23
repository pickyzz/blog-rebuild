import { toString } from "mdast-util-to-string";

/**
 * A remark plugin that adds a `readingTime` field to the frontmatter.
 * Uses Intl.Segmenter for accurate word counting in Thai/Mixed content.
 *
 * @return {import('unified').Plugin<[], import('mdast').Root>} A unified plugin
 */
export function remarkReadingTime() {
  return function (tree, vfile) {
    try {
      const textOnPage = toString(tree) || "";
      
      // Use Intl.Segmenter for accurate word counting (supports Thai)
      const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
      const segments = [...segmenter.segment(textOnPage)];
      const words = segments.filter(s => s.isWordLike).length;
      
      const wordsPerMinute = 200;
      const minutes = words / wordsPerMinute;
      const time = Math.round(minutes * 60 * 1000);
      const displayed = Math.ceil(minutes || 1); // Minimum 1 min
      const text = `${displayed} min read`;

      // Ensure vfile.data and frontmatter objects exist
      if (!vfile || typeof vfile !== "object") return;
      vfile.data = vfile.data || {};
      vfile.data.astro = vfile.data.astro || {};
      vfile.data.astro.frontmatter = vfile.data.astro.frontmatter || {};

      vfile.data.astro.frontmatter.readingTime = text;
    } catch (err) {
      // fallback or swallow errors
      console.warn(
        "[remark-reading-time] failed to compute reading time:",
        err?.message ?? err
      );
    }
  };
}
