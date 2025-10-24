import type { BlogPost } from "@/types";

export interface SearchResult {
  post: BlogPost;
  score: number;
  matches: {
    title?: boolean;
    description?: boolean;
    tags?: boolean;
    content?: boolean;
  };
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  minScore?: number;
}

/**
 * Advanced search utility with fuzzy matching and relevance scoring
 */
export class BlogSearch {
  private posts: BlogPost[];

  constructor(posts: BlogPost[]) {
    this.posts = posts;
  }

  /**
   * Perform advanced search with scoring
   */
  search(options: SearchOptions): {
    results: SearchResult[];
    total: number;
    hasMore: boolean;
    query: string;
  } {
    const { query, limit = 20, offset = 0, minScore = 0.1 } = options;

    if (!query.trim()) {
      return {
        results: [],
        total: 0,
        hasMore: false,
        query,
      };
    }

    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);

    // Score all posts
    const scoredResults: SearchResult[] = this.posts
      .map(post => this.scorePost(post, queryLower, queryWords))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score);

    const total = scoredResults.length;
    const paginatedResults = scoredResults.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      results: paginatedResults,
      total,
      hasMore,
      query,
    };
  }

  /**
   * Score a single post based on query match quality
   */
  private scorePost(
    post: BlogPost,
    queryLower: string,
    queryWords: string[]
  ): SearchResult {
    let totalScore = 0;
    const matches = {
      title: false,
      description: false,
      tags: false,
      content: false,
    };

    // Title matching (highest weight)
    const title = post.data?.title || "";
    const titleScore = this.calculateFieldScore(
      title,
      queryLower,
      queryWords,
      3.0
    );
    if (titleScore > 0) {
      matches.title = true;
      totalScore += titleScore;
    }

    // Description matching (medium weight)
    const description = post.data?.description || "";
    const descScore = this.calculateFieldScore(
      description,
      queryLower,
      queryWords,
      2.0
    );
    if (descScore > 0) {
      matches.description = true;
      totalScore += descScore;
    }

    // Tags matching (high weight)
    const tags = post.data?.tags || [];
    const tagsText = tags.join(" ").toLowerCase();
    const tagsScore = this.calculateFieldScore(
      tagsText,
      queryLower,
      queryWords,
      2.5
    );
    if (tagsScore > 0) {
      matches.tags = true;
      totalScore += tagsScore;
    }

    // Content snippet matching (lower weight)
    // Use first 500 characters to reduce noise and improve relevance
    const contentSnippet = (post.body || "").substring(0, 500).toLowerCase();
    const contentScore = this.calculateFieldScore(
      contentSnippet,
      queryLower,
      queryWords,
      0.5 // Reduced weight to prioritize title/description/tags
    );
    if (contentScore > 0) {
      matches.content = true;
      totalScore += contentScore;
    }

    // Boost recent posts slightly
    const pubDatetime = post.data?.pubDatetime;
    if (pubDatetime && pubDatetime instanceof Date) {
      const daysSincePublished =
        (Date.now() - pubDatetime.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - daysSincePublished / 365); // Boost posts from last year
      totalScore *= 1 + recencyBoost * 0.1;
    }

    // Boost featured posts
    if (post.data?.featured) {
      totalScore *= 1.2;
    }

    return {
      post,
      score: totalScore,
      matches,
    };
  }

  /**
   * Calculate score for a specific field
   */
  private calculateFieldScore(
    fieldText: string,
    queryLower: string,
    queryWords: string[],
    weight: number
  ): number {
    if (!fieldText) return 0;

    const fieldLower = fieldText.toLowerCase();
    let score = 0;

    // Exact phrase match (highest score with bonus)
    if (fieldLower.includes(queryLower)) {
      score += 2.0; // Increased exact match bonus
    }

    // Individual word matches with better logic
    let exactWordMatches = 0;
    let partialWordMatches = 0;

    for (const word of queryWords) {
      if (word.length < 2) continue; // Skip very short words

      // Check for exact word boundaries
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(fieldLower)) {
        exactWordMatches++;
      } else if (fieldLower.includes(word)) {
        partialWordMatches++;
      }
    }

    // Score based on word match quality
    if (queryWords.length > 0) {
      const exactWordRatio = exactWordMatches / queryWords.length;
      const partialWordRatio = partialWordMatches / queryWords.length;

      // Give more weight to exact word matches
      score += exactWordRatio * 1.2; // Increased exact word bonus
      score += partialWordRatio * 0.4; // Reduced partial word bonus
    }

    // Stricter fuzzy matching for partial matches
    score += this.fuzzyMatchScore(fieldLower, queryLower) * 0.15; // Reduced fuzzy influence

    return score * weight;
  }

  /**
   * Stricter fuzzy matching score
   */
  private fuzzyMatchScore(text: string, query: string): number {
    if (query.length < 4) return 0; // Skip fuzzy for very short queries

    let consecutiveMatches = 0;
    let maxConsecutiveMatches = 0;
    let queryIndex = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        consecutiveMatches++;
        queryIndex++;
        maxConsecutiveMatches = Math.max(maxConsecutiveMatches, consecutiveMatches);
      } else {
        consecutiveMatches = 0;
      }
    }

    // Require higher match ratio and consecutive matches for fuzzy score
    const matchRatio = queryIndex / query.length;
    const consecutiveRatio = maxConsecutiveMatches / query.length;

    // Only count fuzzy matches if we have good consecutive matching
    if (consecutiveRatio < 0.5) return 0;

    return matchRatio * consecutiveRatio; // Combined ratio for stricter matching
  }

  /**
   * Get search suggestions based on popular terms
   */
  getSuggestions(): string[] {
    const tagFrequency = new Map<string, number>();

    // Count tag frequency
    this.posts.forEach(post => {
      const tags = post.data?.tags || [];
      tags.forEach(tag => {
        if (tag && typeof tag === "string") {
          tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
        }
      });
    });

    // Return top 10 most frequent tags
    return Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }

  /**
   * Get popular terms from titles and descriptions
   */
  getPopularTerms(): string[] {
    const termFrequency = new Map<string, number>();

    this.posts.forEach(post => {
      const title = post.data?.title || "";
      const description = post.data?.description || "";

      // Extract words from title and description
      const text = `${title} ${description}`.toLowerCase();
      const words = text.match(/\b[a-z]{3,}\b/g) || []; // Only words with 3+ characters

      words.forEach(word => {
        // Skip common words
        const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'has', 'let', 'put', 'say', 'she', 'too', 'use'];
        if (!commonWords.includes(word)) {
          termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
        }
      });
    });

    // Return top 20 most frequent terms
    return Array.from(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term);
  }
}

/**
 * Search result cache
 */
export class SearchCache {
  private cache = new Map<string, { result: any; timestamp: number }>();
  private readonly ttl: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    // 5 minutes default
    this.ttl = ttlMs;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  set(key: string, result: any): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
