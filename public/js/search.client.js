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

  function showLoading() {
    if (loading) loading.classList.remove("hidden");
    if (error) error.classList.add("hidden");
    if (results) results.classList.add("hidden");
    if (noResults) noResults.classList.add("hidden");
  }

  function showError(message) {
    if (loading) loading.classList.add("hidden");
    if (error) {
      error.classList.remove("hidden");
      error.textContent = message;
    }
    if (results) results.classList.add("hidden");
    if (noResults) noResults.classList.add("hidden");
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

    if (resultsTitle) resultsTitle.textContent = `${data.total} result${data.total !== 1 ? "s" : ""} for "${data.query}"`;
    if (postsList) postsList.innerHTML = "";

    data.posts.forEach(function (post) {
      const postElement = document.createElement("article");
      postElement.className = "p-4 transition-shadow border border-gray-200 rounded-lg dark:border-gray-700 hover:shadow-md";

      const pubDate = post.pubDatetime ? new Date(post.pubDatetime).toLocaleDateString() : "";

      postElement.innerHTML = `\n        <h3 class="mb-2 text-lg font-semibold">\n          <a href="/blog/${post.slug}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">\n            ${post.title}\n          </a>\n        </h3>\n        <p class="mb-2 text-gray-600 dark:text-gray-400">${post.description}</p>\n        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">\n          <span>${post.author || ""}${post.author ? " • " : ""}${pubDate}</span>\n          <div class="flex gap-1">\n            ${Array.isArray(post.tags) ? post.tags.map(function(tag){ return `<span class="px-2 py-1 text-xs bg-gray-100 rounded dark:bg-gray-800">${tag}</span>`}).join("") : ""}\n          </div>\n        </div>\n      `;

      if (postsList) postsList.appendChild(postElement);
    });

    if (results) results.classList.remove("hidden");
    if (noResults) noResults.classList.add("hidden");
  }

  function clearResults() {
    if (searchInput) searchInput.value = "";
    if (loading) loading.classList.add("hidden");
    if (error) error.classList.add("hidden");
    if (results) results.classList.add("hidden");
    if (noResults) noResults.classList.add("hidden");
    if (searchInput) searchInput.focus();
  }

  async function performSearch(query) {
    try {
      showLoading();
  // production: no debug logging
      const response = await fetch(`/api/search.json?q=${encodeURIComponent(query)}`);
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

  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const query = searchInput ? searchInput.value.trim() : "";
      if (query) performSearch(query);
    });
  }

  if (clearBtn) clearBtn.addEventListener("click", clearResults);

  if (searchInput) searchInput.focus();
})();
