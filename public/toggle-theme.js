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
  const actualTheme =
    themeValue === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : themeValue;

  if (document.firstElementChild) {
    document.firstElementChild.setAttribute("data-theme", actualTheme);
  }
  const themeBtn = document.querySelector("#theme-btn");
  if (themeBtn) {
    themeBtn.setAttribute("aria-label", themeValue);
    themeBtn.setAttribute("aria-live", "polite");
  }

  // Toggle icons based on theme
  const moonIcon = document.querySelector("#moon-icon");
  const sunIcon = document.querySelector("#sun-icon");
  const autoIcon = document.querySelector("#auto-icon");

  if (moonIcon && sunIcon && autoIcon) {
    // Reset all icons
    moonIcon.style.opacity = "0";
    sunIcon.style.opacity = "0";
    autoIcon.style.opacity = "0";

    if (themeValue === "light") {
      sunIcon.style.opacity = "1";
    } else if (themeValue === "dark") {
      moonIcon.style.opacity = "1";
    } else if (themeValue === "auto") {
      autoIcon.style.opacity = "1";
    }
  }

  const body = document.body;
  if (body) {
    body.setAttribute("data-theme", actualTheme);
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

// Initialize immediately if DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTheme);
} else {
  initializeTheme();
}

function initializeTheme() {
  setThemeFeature();
}

function setThemeFeature() {
  // set on load so screen readers can get the latest value on the button
  reflectPreference();

  // Remove existing event listeners to prevent duplicates
  const existingBtn = document.querySelector("#theme-btn");
  if (existingBtn) {
    existingBtn.replaceWith(existingBtn.cloneNode(true));
  }

  // now this script can find and listen for clicks on the control
  const themeBtn = document.querySelector("#theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", e => {
      e.preventDefault();

      if (themeValue === "light") {
        themeValue = "dark";
      } else if (themeValue === "dark") {
        themeValue = "auto";
      } else {
        themeValue = "light";
      }

      setPreference();
    });
  } else {
    // Retry after a short delay
    setTimeout(() => {
      setThemeFeature();
    }, 100);
  }
}

// Runs on view transitions navigation
document.addEventListener("astro:after-swap", () => {
  setThemeFeature();
});

// Also handle window load as fallback
window.addEventListener("load", () => {
  setThemeFeature();
});

// sync with system changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches: isDark }) => {
    if (themeValue === "auto") {
      reflectPreference();
    }
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
