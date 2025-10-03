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
    const titleScore = this.calculateFieldScore(
      post.data.title,
      queryLower,
      queryWords,
      3.0
    );
    if (titleScore > 0) {
      matches.title = true;
      totalScore += titleScore;
    }

    // Description matching (medium weight)
    const description = post.data.description || "";
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
    const tagsText = post.data.tags.join(" ").toLowerCase();
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
    // Use first 1000 characters for performance
    const contentSnippet = post.body.substring(0, 1000).toLowerCase();
    const contentScore = this.calculateFieldScore(
      contentSnippet,
      queryLower,
      queryWords,
      1.0
    );
    if (contentScore > 0) {
      matches.content = true;
      totalScore += contentScore;
    }

    // Boost recent posts slightly
    const daysSincePublished =
      (Date.now() - post.data.pubDatetime.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - daysSincePublished / 365); // Boost posts from last year
    totalScore *= 1 + recencyBoost * 0.1;

    // Boost featured posts
    if (post.data.featured) {
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

    // Exact phrase match (highest score)
    if (fieldLower.includes(queryLower)) {
      score += 1.0;
    }

    // Individual word matches
    let wordMatches = 0;
    for (const word of queryWords) {
      if (fieldLower.includes(word)) {
        wordMatches++;
      }
    }

    // Score based on word match ratio
    if (queryWords.length > 0) {
      const wordMatchRatio = wordMatches / queryWords.length;
      score += wordMatchRatio * 0.8;
    }

    // Fuzzy matching for partial matches
    score += this.fuzzyMatchScore(fieldLower, queryLower) * 0.3;

    return score * weight;
  }

  /**
   * Simple fuzzy matching score
   */
  private fuzzyMatchScore(text: string, query: string): number {
    if (query.length < 3) return 0; // Skip fuzzy for short queries

    let matches = 0;
    let queryIndex = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        matches++;
        queryIndex++;
      }
    }

    return queryIndex / query.length; // Ratio of matched characters
  }

  /**
   * Get search suggestions based on popular terms
   */
  getSuggestions(): string[] {
    const tagFrequency = new Map<string, number>();

    // Count tag frequency
    this.posts.forEach(post => {
      post.data.tags.forEach(tag => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    });

    // Return top 10 most frequent tags
    return Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
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
