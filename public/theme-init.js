// Blocking, same-origin initialization before CSS/Angular prevents a wrong-theme first paint.
(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('niva.theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    /* System theme is still usable when persistence is blocked. */
  }
  const resolved =
    preference === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.style.backgroundColor = resolved === 'dark' ? '#0e1727' : '#f7faff';
})();
