// Client-side search logic (plain JS)
(function () {
  /**
   * @typedef {{id:string,slug:string,title:string,description:string,pubDatetime:string|null,tags:string[],author?:string}} Post
   * @typedef {{posts:Post[],total:number,query:string}} SearchResponse
   */

  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  // debug element removed
  const results = document.getElementById("results");
  const resultsTitle = document.getElementById("resultsTitle");
  const postsList = document.getElementById("postsList");
  const noResults = document.getElementById("noResults");
  const clearBtn = document.getElementById("clearBtn");
  const suggestions = document.getElementById("suggestions");
  const suggestionTags = document.getElementById("suggestionTags");

  // Add search indicator element
  let searchIndicator = null;
  if (searchInput && !searchIndicator) {
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

    // Make input container relative for positioning
    const inputContainer = searchInput.parentElement;
    inputContainer.style.position = "relative";
    inputContainer.appendChild(searchIndicator);
  }

  function showLoading() {
    if (loading) loading.classList.remove("hidden");
    if (error) error.classList.add("hidden");
    if (results) results.classList.add("hidden");
    if (noResults) noResults.classList.add("hidden");
    if (searchIndicator) {
      searchIndicator.style.display = "block";
    }
  }

  function showError(message) {
    if (loading) loading.classList.add("hidden");
    if (error) {
      error.classList.remove("hidden");
      error.textContent = message;
    }
    if (results) results.classList.add("hidden");
    if (noResults) noResults.classList.add("hidden");
    if (searchIndicator) {
      searchIndicator.style.display = "none";
    }
    // no debug output in UI
  }

  function logDebug() {
    // noop: debug logging removed in production
  }

  function showResults(data) {
    if (loading) loading.classList.add("hidden");
    if (error) error.classList.add("hidden");

    if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
      if (noResults) noResults.classList.remove("hidden");
      if (results) results.classList.add("hidden");
      return;
    }

    if (resultsTitle)
      resultsTitle.textContent = `${data.total} result${data.total !== 1 ? "s" : ""} for "${data.query}"`;
    if (postsList) postsList.innerHTML = "";

    data.posts.forEach(function (post) {
      const postElement = document.createElement("article");
      postElement.className =
        "p-4 transition-shadow border border-gray-200 rounded-lg dark:border-gray-700 hover:shadow-md";

      const pubDate = post.pubDatetime
        ? new Date(post.pubDatetime).toLocaleDateString()
        : "";

      // Match reasons display removed
      const matchReasonsHtml = "";

      postElement.innerHTML = `\n        ${matchReasonsHtml}\n        <h3 class="mb-2 text-lg font-semibold">\n          <a href="/blog/${post.slug}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">\n            ${post.title}\n          </a>\n        </h3>\n        <p class="mb-2 text-gray-600 dark:text-gray-400">${post.description}</p>\n        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">\n          <span>${post.author || ""}${post.author ? " • " : ""}${pubDate}</span>\n          <div class="flex gap-1">\n            ${
        Array.isArray(post.tags)
          ? post.tags
              .map(function (tag) {
                return `<span class="px-2 py-1 text-xs bg-gray-100 rounded dark:bg-gray-800">${tag}</span>`;
              })
              .join("")
          : ""
      }\n          </div>\n        </div>\n      `;

      if (postsList) postsList.appendChild(postElement);
    });

    if (results) results.classList.remove("hidden");
    if (noResults) noResults.classList.add("hidden");

    // Hide suggestions when showing results
    if (suggestions) suggestions.classList.add("hidden");

    // Hide search indicator
    if (searchIndicator) {
      searchIndicator.style.display = "none";
    }

    // Update URL with search query
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

    // Show suggestions when clearing results
    if (suggestions) suggestions.classList.remove("hidden");

    // Hide search indicator
    if (searchIndicator) {
      searchIndicator.style.display = "none";
    }

    // Clear URL parameter
    const url = new URL(window.location);
    url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
  }

  async function loadSuggestions() {
    try {
      const response = await fetch("/api/search.json?suggestions=true");
      if (!response.ok) return;

      const data = await response.json();
      if (suggestionTags && (data.suggestions || data.popularTerms)) {
        const allSuggestions = [
          ...(data.suggestions || []),
          ...(data.popularTerms || []),
        ];
        const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 10);

        suggestionTags.innerHTML = uniqueSuggestions
          .map(
            term =>
              `<button type="button" class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800" onclick="useSuggestion('${term}')">${term}</button>`
          )
          .join("");
      }
    } catch (err) {
      console.error("Failed to load suggestions:", err);
    }
  }

  // Global function for suggestion buttons
  window.useSuggestion = function (term) {
    if (searchInput) {
      searchInput.value = term;
      searchInput.focus();
      // Clear any pending debounced search
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      performSearch(term);
    }
  };

  async function performSearch(query) {
    try {
      showLoading();
      // production: no debug logging
      const response = await fetch(
        `/api/search.json?q=${encodeURIComponent(query)}`
      );
      // no debug logging
      if (!response.ok) {
        // do not surface response body to UI
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      // no debug logging
      showResults(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      showError(msg);
    }
  }

  // Real-time search with debouncing
  let searchTimeout;

  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      const query = e.target.value.trim();

      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // If query is empty, clear results
      if (!query) {
        clearResults();
        return;
      }

      // Debounce search - wait 300ms after typing stops
      searchTimeout = setTimeout(() => {
        if (query) performSearch(query);
      }, 300);
    });
  }

  // Keep form submission for accessibility (Enter key)
  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const query = searchInput ? searchInput.value.trim() : "";
      if (query) {
        // Clear any pending debounced search
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        performSearch(query);
      }
    });
  }

  if (clearBtn) clearBtn.addEventListener("click", clearResults);

  if (searchInput) {
    searchInput.focus();
    // Trigger search on initial load if there's a query in URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get("q");
    if (initialQuery) {
      searchInput.value = initialQuery;
      performSearch(initialQuery);
    }
  }

  // Load suggestions on page load
  loadSuggestions();
})();
