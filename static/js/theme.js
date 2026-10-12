const themeToggle = document.querySelector(".theme-toggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (themeToggle) {
    const isLight = theme === "light";
    const label = isLight ? "Switch to dark mode" : "Switch to light mode";

    themeToggle.textContent = isLight ? "☾" : "☀";
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
  }
}

if (themeToggle) {
  const currentTheme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";

  applyTheme(currentTheme);

  themeToggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";

    applyTheme(nextTheme);

    try {
      localStorage.setItem("theme", nextTheme);
    } catch (error) {
      // Theme switching still works if preferences cannot be saved.
    }
  });
}
