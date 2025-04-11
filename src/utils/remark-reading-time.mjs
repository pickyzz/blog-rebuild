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
  return function (tree, { data }) {
    const textOnPage = toString(tree);
    const readingTime = getReadingTime(textOnPage);
    data.astro.frontmatter.readingTime = readingTime.text;
  };
}
