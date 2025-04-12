import type { CollectionEntry } from "astro:content";

type GroupKey = string | number | symbol;

interface GroupFunction<T> {
  (item: T, index?: number): GroupKey;
}

/**
 * Group posts by a condition.
 *
 * @param posts The posts to group.
 * @param groupFunction A function that takes a post and returns a group key.
 * @returns An object whose keys are the group keys and whose values are arrays of posts.
 */
const getPostsByGroupCondition = (
  posts: CollectionEntry<"blog">[],
  groupFunction: GroupFunction<CollectionEntry<"blog">>,
) => {
  const result: Record<GroupKey, CollectionEntry<"blog">[]> = {};
  for (let i = 0; i < posts.length; i++) {
    const item = posts[i];
    const groupKey = groupFunction(item, i);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
  }
  return result;
};

export default getPostsByGroupCondition;
