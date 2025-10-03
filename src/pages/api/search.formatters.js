// Exported in plain JS so test runner can import without TypeScript tooling.
export function formatSearchResult(result) {
  const post = result.post || {};
  const data = post.data || {};

  return {
    id: post.id,
    slug: post.slug,
    title: data.title || "",
    description: data.description || "",
    pubDatetime: data.pubDatetime ? (data.pubDatetime instanceof Date ? data.pubDatetime.toISOString() : String(data.pubDatetime)) : null,
    modDatetime: data.modDatetime ? (data.modDatetime instanceof Date ? data.modDatetime.toISOString() : String(data.modDatetime)) : null,
    featured: data.featured || false,
    tags: data.tags || [],
    readingTime: data.readingTime || null,
    score: result.score,
    matches: result.matches,
  };
}

export default formatSearchResult;
