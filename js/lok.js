(function () {
  'use strict';

  var root = document.documentElement;
  var header = document.querySelector('[data-site-header]');
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-site-nav]');
  var scrim = document.querySelector('[data-menu-scrim]');
  var themeToggle = document.getElementById('color-toggle-btn');
  var lastFocused = null;
  var mobileQuery = window.matchMedia('(max-width: 900px)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var progressBar = document.querySelector('[data-reading-progress] span');

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncThemeButton() {
    if (!themeToggle) return;
    var light = currentTheme() === 'light';
    var next = light ? '深色' : '浅色';
    var label = '切换为' + next + '主题';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
    themeToggle.setAttribute('aria-pressed', light ? 'true' : 'false');
  }

  function syncGiscus() {
    var wrap = document.querySelector('.giscus-wrap');
    var frame = document.querySelector('iframe.giscus-frame');
    if (!wrap || !frame || !frame.contentWindow) return;
    var light = currentTheme() === 'light';
    var theme = light ? wrap.dataset.giscusLight : wrap.dataset.giscusDark;
    frame.contentWindow.postMessage({
      giscus: { setConfig: { theme: theme } }
    }, 'https://giscus.app');
  }

  // The actual switch is handled by Fluid's color-schema.js. This only
  // mirrors the resulting state into accessible labels and our CSS attribute.
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      window.setTimeout(syncThemeButton, 0);
    });
  }

  if (!root.getAttribute('data-theme')) {
    var saved = null;
    try {
      saved = localStorage.getItem('Fluid_Color_Scheme');
    } catch (error) {}
    root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
  }

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncThemeButton();
      syncGiscus();
    }).observe(root, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }
  syncThemeButton();
  window.addEventListener('load', function () {
    window.setTimeout(syncGiscus, 1200);
  });

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

  // A spring-smoothed reading progress indicator for article pages.
  if (progressBar) {
    var progressTarget = 0;
    var progressCurrent = 0;
    var progressRaf = 0;

    function measureProgress() {
      var doc = document.documentElement;
      var scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      progressTarget = Math.min(1, Math.max(0, window.scrollY / scrollable));
      if (reducedMotion.matches) {
        progressCurrent = progressTarget;
        progressBar.style.transform = 'scaleX(' + progressCurrent + ')';
      } else if (!progressRaf) {
        progressRaf = window.requestAnimationFrame(tickProgress);
      }
    }

    function tickProgress() {
      progressCurrent += (progressTarget - progressCurrent) * 0.16;
      if (Math.abs(progressTarget - progressCurrent) < 0.0004) {
        progressCurrent = progressTarget;
      }
      progressBar.style.transform = 'scaleX(' + progressCurrent + ')';
      progressRaf = progressCurrent === progressTarget
        ? 0
        : window.requestAnimationFrame(tickProgress);
    }

    window.addEventListener('scroll', measureProgress, { passive: true });
    window.addEventListener('resize', measureProgress, { passive: true });
    measureProgress();
  }

  // On small screens the TOC is a collapsed disclosure above the article.
  var postToc = document.querySelector('[data-post-toc]');
  if (postToc) {
    var tocQuery = window.matchMedia('(max-width: 1024px)');
    var syncToc = function () {
      if (tocQuery.matches) {
        postToc.removeAttribute('open');
      } else {
        postToc.setAttribute('open', '');
      }
    };
    syncToc();
    if (typeof tocQuery.addEventListener === 'function') {
      tocQuery.addEventListener('change', syncToc);
    } else if (typeof tocQuery.addListener === 'function') {
      tocQuery.addListener(syncToc);
    }
  }

  // Make external links in article and page content open safely in a new tab.
  document.querySelectorAll('.post-content a[href], .prose--page a[href]').forEach(function (link) {
    var href = link.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    if (link.hostname === window.location.hostname) return;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
})();
