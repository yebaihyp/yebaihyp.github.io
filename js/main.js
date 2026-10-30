(function () {
  'use strict';

  var root = document.documentElement;
  var header = document.querySelector('[data-site-header]');
  var themeToggle = document.querySelector('[data-theme-toggle]');
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-site-nav]');
  var scrim = document.querySelector('[data-menu-scrim]');
  var themeMeta = document.querySelector('[data-theme-color]');
  var themeColors = { dark: '#050912', light: '#eef3f4' };
  var lastFocused = null;
  var mobileQuery = window.matchMedia('(max-width: 900px)');

  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncThemeButton() {
    if (!themeToggle) return;
    var next = currentTheme() === 'light' ? '深色' : '浅色';
    var label = '切换为' + next + '主题';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
    themeToggle.setAttribute('aria-pressed', currentTheme() === 'light' ? 'true' : 'false');
  }

  function setTheme(theme, persist) {
    var value = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', value);
    if (themeMeta) themeMeta.setAttribute('content', themeColors[value]);
    syncThemeButton();
    if (persist) {
      try {
        localStorage.setItem('loke-theme', value);
      } catch (error) {}
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(currentTheme() === 'light' ? 'dark' : 'light', true);
    });
  }

  if (themeMeta) {
    themeMeta.setAttribute('content', themeColors[currentTheme()]);
  }
  syncThemeButton();

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function openMenu() {
    if (!nav || !menuToggle) return;
    lastFocused = document.activeElement;
    document.body.classList.add('menu-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', '关闭菜单');
    menuToggle.setAttribute('title', '关闭菜单');
    if (scrim) scrim.hidden = false;
    var first = nav.querySelector('a');
    if (first) {
      window.setTimeout(function () {
        first.focus({ preventScroll: true });
      }, 60);
    }
  }

  function closeMenu(returnFocus) {
    if (!nav || !menuToggle) return;
    document.body.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开菜单');
    menuToggle.setAttribute('title', '打开菜单');
    if (scrim) scrim.hidden = true;
    if (returnFocus && lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      if (document.body.classList.contains('menu-open')) {
        closeMenu(true);
      } else {
        openMenu();
      }
    });
  }

  if (scrim) {
    scrim.addEventListener('click', function () {
      closeMenu(true);
    });
  }

  if (nav) {
    nav.addEventListener('click', function (event) {
      var target = event.target.closest('a');
      if (target) closeMenu(false);
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('menu-open')) {
      closeMenu(true);
    }
  });

  function handleBreakpoint(event) {
    if (!event.matches && document.body.classList.contains('menu-open')) {
      closeMenu(false);
    }
  }

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', handleBreakpoint);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(handleBreakpoint);
  }

  // Make external links in article and page content open safely in a new tab.
  var contentLinks = document.querySelectorAll('.post-content a[href], .prose--page a[href]');
  contentLinks.forEach(function (link) {
    var href = link.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    if (link.hostname === window.location.hostname) return;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
})();
