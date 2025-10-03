import formatSearchResult from '../src/pages/api/search.formatters.js';
import { SearchResponseSchema } from '../src/pages/api/search.schema.js';
import assert from 'assert';

function buildResponseFromResults(results) {
  const posts = results.map(r => formatSearchResult(r));
  return {
    posts,
    total: posts.length,
    hasMore: false,
    query: 'test',
    pagination: {
      limit: 20,
      offset: 0,
      currentPage: 1,
      totalPages: 1,
    },
  };
}

try {
  // Case 1: valid date
  const r1 = {
    post: { id: '1', slug: 'p1', data: { title: 'a', description: 'b', pubDatetime: new Date('2024-01-01T00:00:00Z'), tags: ['t'] } },
    score: 1,
    matches: [],
  };

  const response1 = buildResponseFromResults([r1]);
  SearchResponseSchema.parse(response1);

  // Case 2: missing pubDatetime
  const r2 = {
    post: { id: '2', slug: 'p2', data: { title: 'x', description: 'y', tags: [] } },
    score: 0.5,
    matches: [],
  };

  const response2 = buildResponseFromResults([r2]);
  SearchResponseSchema.parse(response2);

  console.log('Search schema tests passed');
  process.exit(0);
} catch (err) {
  console.error('Search schema tests failed:', err);
  process.exit(1);
}
