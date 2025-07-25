const primaryColorScheme = "dark"; // "light" | "dark"

// Utility: get theme from query string
function getThemeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("theme");
}
// Utility: get theme from cookie
function getThemeFromCookie() {
  const match = document.cookie.match(/(?:^|; )theme=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
// Utility: choose storage type
function getThemeFromStorage() {
  // Use sessionStorage if available, fallback to localStorage
  return sessionStorage.getItem("theme") || localStorage.getItem("theme");
}

function getPreferTheme() {
  // Priority: query string > cookie > storage > primaryColorScheme > system
  const queryTheme = getThemeFromQuery();
  if (queryTheme) return queryTheme;
  const cookieTheme = getThemeFromCookie();
  if (cookieTheme) return cookieTheme;
  const storageTheme = getThemeFromStorage();
  if (storageTheme) return storageTheme;
  if (primaryColorScheme) return primaryColorScheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

let themeValue = getPreferTheme();

function setPreference() {
  // Save to both storages for flexibility
  localStorage.setItem("theme", themeValue);
  sessionStorage.setItem("theme", themeValue);
  reflectPreference();
}

function reflectPreference() {
  if (document.firstElementChild) {
    document.firstElementChild.setAttribute("data-theme", themeValue);
  }
  const themeBtn = document.querySelector("#theme-btn");
  if (themeBtn) {
    themeBtn.setAttribute("aria-label", themeValue);
    // Add aria-live for accessibility
    themeBtn.setAttribute("aria-live", "polite");
  }
  const body = document.body;
  if (body) {
    body.setAttribute("data-theme", themeValue);
    const computedStyles = window.getComputedStyle(body);
    const bgColor = computedStyles.backgroundColor;
    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute("content", bgColor);
  }
}

// set early so no page flashes / CSS is made aware
reflectPreference();

window.onload = () => {
  function setThemeFeature() {
    // set on load so screen readers can get the latest value on the button
    reflectPreference();

    // now this script can find and listen for clicks on the control
    document.querySelector("#theme-btn")?.addEventListener("click", () => {
      themeValue = themeValue === "light" ? "dark" : "light";
      setPreference();
    });
  }

  setThemeFeature();

  // Runs on view transitions navigation
  document.addEventListener("astro:after-swap", setThemeFeature);
};

// sync with system changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches: isDark }) => {
    themeValue = isDark ? "dark" : "light";
    setPreference();
  });

// sync theme across tabs/windows
window.addEventListener("storage", event => {
  if (event.key === "theme") {
    themeValue = getPreferTheme(); // Always update from localStorage
    reflectPreference();
  }
});

// Listen for primaryColorScheme change (if changed at runtime)
window.addEventListener("primaryColorSchemeChange", () => {
  themeValue = getPreferTheme();
  setPreference();
});
