import { SITE } from "@/config";
import type { BlogPost } from "@/types";

/**
 * Filter for Astro's content collection.
 *
 * @remarks
 * - Always includes non-draft posts in development mode.
 * - Includes posts whose publish time has passed the scheduled time minus a margin.
 *
 * @param post - A post from the Astro content collection.
 * @returns Whether to include the post in the collection.
 */
const postFilter = ({ data }: CollectionEntry<"blog">) => {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;
  return !data.draft && (import.meta.env.DEV || isPublishTimePassed);
};

export default postFilter;
