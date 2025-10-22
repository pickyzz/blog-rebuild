import type { BlogPost } from "@/types";
import postFilter from "./postFilter";

const getSortedPosts = (posts: CollectionEntry<"blog">[] = []) => {
  return posts.filter(postFilter).sort((a, b) => {
    // Handle dates that might be strings or Date objects
    const getTimestamp = (datetime: any) => {
      const date = datetime instanceof Date ? datetime : new Date(datetime);
      return date.getTime() / 1000;
    };

    const bTime =
      b.data.modDatetime && b.data.modDatetime > b.data.pubDatetime
        ? getTimestamp(b.data.modDatetime)
        : getTimestamp(b.data.pubDatetime);

    const aTime =
      a.data.modDatetime && a.data.modDatetime > a.data.pubDatetime
        ? getTimestamp(a.data.modDatetime)
        : getTimestamp(a.data.pubDatetime);

    return Math.floor(bTime) - Math.floor(aTime);
  });
};

export default getSortedPosts;
