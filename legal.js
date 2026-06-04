/**
 * Shared language switcher for standalone legal pages (impressum, datenschutz).
 * Reads/writes the same 'dkb-lang' key as the main app so the preference
 * is shared across all pages.
 */
(function () {
  const STORAGE_KEY = 'dkb-lang';
  const LANGS = ['de', 'en'];

  function getLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(saved) ? saved : 'de';
  }

  function applyLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;

    // Show/hide language content blocks
    document.querySelectorAll('[data-lang]').forEach(el => {
      el.style.display = el.dataset.lang === lang ? '' : 'none';
    });

    // Update switcher buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  function init() {
    const lang = getLang();
    applyLang(lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => applyLang(btn.dataset.lang));
    });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
