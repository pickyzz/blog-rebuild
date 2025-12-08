/**
 * Static search implementation for SSG
 * Works with static JSON data generated during build
 */

(function () {
  "use strict";

  class StaticSearch {
    constructor() {
      this.searchData = [];
      this.searchIndex = new Map();
      this.isLoaded = false;
      this.cache = new Map();
    }

    async loadSearchData() {
      if (this.isLoaded) return;

      try {
        const response = await fetch("/data/search.json");
        if (!response.ok) {
          throw new Error(`Failed to load search data: ${response.status}`);
        }

        this.searchData = await response.json();
        this.buildSearchIndex();
        this.isLoaded = true;

        console.log(`Loaded ${this.searchData.length} posts for search`);
      } catch (error) {
        console.error("Failed to load search data:", error);
        this.searchData = [];
        this.isLoaded = true; // Mark as loaded to prevent retry loops
      }
    }

    buildSearchIndex() {
      // Build inverted index for faster searching
      this.searchIndex.clear();

      this.searchData.forEach((post, index) => {
        const searchableText = [
          post.title,
          post.description,
          ...(post.tags || []),
        ]
          .join(" ")
          .toLowerCase();

        const words = searchableText
          .split(/\s+/)
          .filter(word => word.length > 2);

        words.forEach(word => {
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, new Set());
          }
          this.searchIndex.get(word).add(index);
        });
      });
    }

    search(query, options = {}) {
      if (!this.isLoaded) {
        console.warn("Search data not loaded yet");
        return { posts: [], total: 0, query };
      }

      const { limit = 20, offset = 0, minScore = 0.1 } = options;
      const queryLower = query.toLowerCase().trim();

      if (!queryLower) {
        return {
          posts: [],
          total: 0,
          query: queryLower,
          hasMore: false,
        };
      }

      // Check cache first
      const cacheKey = `${queryLower}_${limit}_${offset}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const queryWords = queryLower
        .split(/\s+/)
        .filter(word => word.length > 2);
      const matchingPosts = new Map();

      // Find matching posts using the inverted index
      queryWords.forEach(word => {
        const matchingIndices = this.searchIndex.get(word);
        if (matchingIndices) {
          matchingIndices.forEach(index => {
            const post = this.searchData[index];
            const currentScore = matchingPosts.get(post) || 0;

            // Calculate relevance score
            let score = 0;
            const titleLower = post.title.toLowerCase();
            const descLower = post.description.toLowerCase();

            // Higher score for title matches
            if (titleLower.includes(word)) {
              score += 2.0;
            }

            // Medium score for description matches
            if (descLower.includes(word)) {
              score += 1.0;
            }

            // Lower score for tag matches
            if (
              post.tags &&
              post.tags.some(tag => tag.toLowerCase().includes(word))
            ) {
              score += 0.5;
            }

            // Bonus for exact word matches
            if (titleLower === word || descLower === word) {
              score += 3.0;
            }

            matchingPosts.set(post, currentScore + score);
          });
        }
      });

      // Convert to array and sort by score
      const scoredResults = Array.from(matchingPosts.entries())
        .map(([post, score]) => ({ ...post, relevanceScore: score }))
        .filter(post => post.relevanceScore >= minScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      const total = scoredResults.length;
      const paginatedResults = scoredResults.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      const result = {
        posts: paginatedResults,
        total,
        hasMore,
        query: queryLower,
        pagination: {
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
        },
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    }

    getSuggestions() {
      if (!this.isLoaded || this.searchData.length === 0) {
        return [];
      }

      const tagCounts = new Map();

      this.searchData.forEach(post => {
        if (post.tags) {
          post.tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });

      return Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
    }

    getPopularTerms() {
      if (!this.isLoaded || this.searchData.length === 0) {
        return [];
      }

      // Extract popular terms from titles and descriptions
      const wordCounts = new Map();

      this.searchData.forEach(post => {
        const text = `${post.title} ${post.description}`.toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 3);

        words.forEach(word => {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        });
      });

      return Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
    }
  }

  // Initialize search instance
  window.staticSearch = new StaticSearch();

  // Auto-load search data when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.staticSearch.loadSearchData();
    });
  } else {
    window.staticSearch.loadSearchData();
  }

  // Initialize search UI
  function initializeSearchUI() {
    const searchForm = document.getElementById("searchForm");
    const searchInput = document.getElementById("searchInput");
    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    const results = document.getElementById("results");
    const resultsTitle = document.getElementById("resultsTitle");
    const postsList = document.getElementById("postsList");
    const noResults = document.getElementById("noResults");
    const clearBtn = document.getElementById("clearBtn");
    const suggestions = document.getElementById("suggestions");
    const suggestionTags = document.getElementById("suggestionTags");

    if (!searchForm || !searchInput) return;

    let searchIndicator = null;
    if (!searchIndicator) {
      searchIndicator = document.createElement("div");
      searchIndicator.className =
        "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400";
      searchIndicator.style.display = "none";
      searchIndicator.innerHTML = `
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
      searchInput.parentElement.style.position = "relative";
      searchInput.parentElement.appendChild(searchIndicator);
    }

    function showLoading() {
      if (loading) loading.classList.remove("hidden");
      if (error) error.classList.add("hidden");
      if (results) results.classList.add("hidden");
      if (noResults) noResults.classList.add("hidden");
      if (searchIndicator) searchIndicator.style.display = "block";
    }

    function showError(message) {
      if (loading) loading.classList.add("hidden");
      if (error) {
        error.classList.remove("hidden");
        error.textContent = message;
      }
      if (results) results.classList.add("hidden");
      if (noResults) noResults.classList.add("hidden");
      if (searchIndicator) searchIndicator.style.display = "none";
    }

    function showResults(data) {
      if (loading) loading.classList.add("hidden");
      if (error) error.classList.add("hidden");

      if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
        if (noResults) noResults.classList.remove("hidden");
        if (results) results.classList.add("hidden");
        return;
      }

      if (resultsTitle) {
        resultsTitle.textContent = `${data.total} result${data.total !== 1 ? "s" : ""} for "${data.query}"`;
      }
      if (postsList) postsList.innerHTML = "";

      data.posts.forEach(post => {
        const postElement = document.createElement("article");
        postElement.className =
          "p-4 transition-shadow border border-gray-200 rounded-lg dark:border-gray-700 hover:shadow-md";

        const pubDate = post.pubDatetime
          ? new Date(post.pubDatetime).toLocaleDateString()
          : "";

        postElement.innerHTML = `
          <h3 class="mb-2 text-lg font-semibold">
            <a href="/blog/${post.slug}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              ${post.title}
            </a>
          </h3>
          <p class="mb-2 text-gray-600 dark:text-gray-400">${post.description}</p>
          <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>${post.author || ""}${post.author ? " • " : ""}${pubDate}</span>
            <div class="flex gap-1">
              ${
                Array.isArray(post.tags)
                  ? post.tags
                      .map(
                        tag =>
                          `<span class="px-2 py-1 text-xs bg-gray-100 rounded dark:bg-gray-800">${tag}</span>`
                      )
                      .join("")
                  : ""
              }
            </div>
          </div>
        `;

        if (postsList) postsList.appendChild(postElement);
      });

      if (results) results.classList.remove("hidden");
      if (noResults) noResults.classList.add("hidden");
      if (suggestions) suggestions.classList.add("hidden");
      if (searchIndicator) searchIndicator.style.display = "none";

      // Update URL
      const url = new URL(window.location);
      if (data.query) {
        url.searchParams.set("q", data.query);
        window.history.replaceState({}, "", url);
      }
    }

    function clearResults() {
      if (searchInput) searchInput.value = "";
      if (loading) loading.classList.add("hidden");
      if (error) error.classList.add("hidden");
      if (results) results.classList.add("hidden");
      if (noResults) noResults.classList.add("hidden");
      if (searchInput) searchInput.focus();
      if (suggestions) suggestions.classList.remove("hidden");
      if (searchIndicator) searchIndicator.style.display = "none";

      const url = new URL(window.location);
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url);
    }

    async function loadSuggestions() {
      try {
        if (!window.staticSearch.isLoaded) {
          await window.staticSearch.loadSearchData();
        }

        const suggestions = window.staticSearch.getSuggestions();
        const popularTerms = window.staticSearch.getPopularTerms();

        if (
          suggestionTags &&
          (suggestions.length > 0 || popularTerms.length > 0)
        ) {
          const allSuggestions = [...suggestions, ...popularTerms].slice(0, 10);
          const uniqueSuggestions = [...new Set(allSuggestions)];

          suggestionTags.innerHTML = uniqueSuggestions
            .map(
              term =>
                `<button type="button" class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800" onclick="useSuggestion('${term}')">${term}</button>`
            )
            .join("");
        }
      } catch (err) {
        console.warn("Failed to load suggestions:", err);
      }
    }

    window.useSuggestion = function (term) {
      if (searchInput) {
        searchInput.value = term;
        searchForm.dispatchEvent(new Event("submit"));
      }
    };

    // Handle form submission
    searchForm.addEventListener("submit", async e => {
      e.preventDefault();

      const query = searchInput.value.trim();
      if (!query) return;

      showLoading();

      try {
        if (!window.staticSearch.isLoaded) {
          await window.staticSearch.loadSearchData();
        }

        const result = window.staticSearch.search(query, { limit: 20 });
        showResults(result);
      } catch (error) {
        showError("Search failed. Please try again.");
        console.error("Search error:", error);
      }
    });

    // Clear button
    if (clearBtn) {
      clearBtn.addEventListener("click", clearResults);
    }

    // Load suggestions on page load
    loadSuggestions();

    // Handle URL parameters on load
    const url = new URL(window.location);
    const queryParam = url.searchParams.get("q");
    if (queryParam) {
      searchInput.value = queryParam;
      searchForm.dispatchEvent(new Event("submit"));
    }
  }

  // Initialize search UI when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSearchUI);
  } else {
    initializeSearchUI();
  }
})();
