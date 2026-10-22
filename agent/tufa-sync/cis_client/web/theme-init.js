// Applies the saved (or the system's) colour scheme before the page paints, so a dark page
// never flashes white; Mantine takes over once the app runs (src/theme.ts). The choice lives
// in the UI preferences entry (src/lib/preferences.ts).
(function () {
  var theme = "auto";
  try {
    theme = JSON.parse(localStorage.getItem("cis-client.preferences") || "{}").theme || "auto";
  } catch (error) {
    // No storage or an unreadable entry: follow the system.
  }
  var dark =
    theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-mantine-color-scheme", dark ? "dark" : "light");
})();
