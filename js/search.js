(function () {
  'use strict';

  var page = document.querySelector('[data-search-page]');
  if (!page) return;

  var indexUrl = page.getAttribute('data-search-index');
  var input = page.querySelector('[data-search-input]');
  var results = page.querySelector('[data-search-results]');
  var status = page.querySelector('[data-search-status]');
  var empty = page.querySelector('[data-search-empty]');
  var MIN_LENGTH = 3;
  var MAX_RESULTS = 24;
  var entries = null;
  var loadError = false;
  var loading = false;
  var pendingQuery = '';
  var debounceTimer = 0;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeEntities(value) {
    var text = String(value == null ? '' : value);
    if (text.indexOf('&') === -1) return text;
    var decoder = document.createElement('textarea');
    decoder.innerHTML = text;
    return decoder.value;
  }

  function normalize(value) {
    return String(value == null ? '' : value).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function listOf(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    return String(value).split(/[,，]/).map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '.' + month + '.' + day;
  }

  function makeExcerpt(content, needle) {
    var text = String(content || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    var lower = text.toLowerCase();
    var at = lower.indexOf(needle.toLowerCase());
    if (at < 0) return text.slice(0, 150) + (text.length > 150 ? '…' : '');
    var start = Math.max(0, at - 44);
    var piece = text.slice(start, start + 190);
    if (start > 0) piece = '…' + piece;
    if (start + 190 < text.length) piece += '…';
    return piece;
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function showEmpty(show) {
    if (empty) empty.hidden = !show;
  }

  function renderResults(query, matches) {
    if (!results) return;
    if (!matches.length) {
      results.innerHTML = '';
      setStatus('没有找到与「' + query + '」相关的笔记。');
      showEmpty(true);
      return;
    }

    showEmpty(false);
    setStatus('找到 ' + matches.length + ' 篇相关笔记' +
      (matches.length >= MAX_RESULTS ? '，仅显示前 ' + MAX_RESULTS + ' 篇。' : '。'));

    results.innerHTML = matches.slice(0, MAX_RESULTS).map(function (entry) {
      var title = escapeHtml(decodeEntities(entry.title || '未命名笔记'));
      var url = escapeHtml(entry.url || '/');
      var categories = listOf(decodeEntities(listOf(entry.categories).join(',')));
      var tags = listOf(decodeEntities(listOf(entry.tags).join(',')));
      var metaParts = [];
      if (entry.date) metaParts.push('<time>' + escapeHtml(formatDate(entry.date)) + '</time>');
      if (categories.length) metaParts.push('<span>' + escapeHtml(categories[0]) + '</span>');
      var meta = metaParts.length ? '<div class="search-result__meta">' + metaParts.join('<span class="meta-dot" aria-hidden="true"></span>') + '</div>' : '';
      var tagLine = tags.length ? '<span class="search-result__tags">' + tags.slice(0, 3).map(function (tag) {
        return '#' + escapeHtml(tag);
      }).join(' ') + '</span>' : '';
      var excerpt = makeExcerpt(decodeEntities(entry.content), query);
      return '<a class="search-result" href="' + url + '">' +
        meta +
        '<h3>' + title + '</h3>' +
        (excerpt ? '<p>' + escapeHtml(excerpt) + '</p>' : '') +
        (tagLine ? '<span class="search-result__foot">' + tagLine + '</span>' : '') +
        '</a>';
    }).join('');
  }

  function search() {
    var query = input ? input.value.trim() : '';
    pendingQuery = query;
    if (query.length < MIN_LENGTH) {
      if (results) results.innerHTML = '';
      showEmpty(false);
      if (!query) {
        setStatus('输入至少 ' + MIN_LENGTH + ' 个字符开始搜索。');
      } else {
        setStatus('至少再输入 ' + (MIN_LENGTH - query.length) + ' 个字符。');
      }
      return;
    }

    if (loadError) {
      if (results) results.innerHTML = '';
      showEmpty(false);
      setStatus('搜索索引加载失败，请刷新页面后重试。');
      return;
    }

    if (!entries) {
      setStatus(loading ? '正在加载搜索索引…' : '正在准备搜索索引…');
      return;
    }

    var needle = normalize(query);
    var matches = entries.filter(function (entry) {
      var categories = listOf(entry.categories).join(' ');
      var tags = listOf(entry.tags).join(' ');
      var haystack = normalize([entry.title, categories, tags, entry.content].join(' '));
      return haystack.indexOf(needle) !== -1;
    });

    renderResults(query, matches);
  }

  function loadIndex() {
    if (!indexUrl) {
      loadError = true;
      setStatus('没有找到搜索索引路径。');
      return;
    }
    loading = true;
    setStatus('正在加载搜索索引…');
    fetch(indexUrl, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        entries = Array.isArray(data) ? data : (data && Array.isArray(data.posts) ? data.posts : []);
        loading = false;
        if (pendingQuery) search();
        else setStatus('输入至少 ' + MIN_LENGTH + ' 个字符开始搜索。');
      })
      .catch(function () {
        loading = false;
        loadError = true;
        setStatus('搜索索引加载失败，请刷新页面后重试。');
      });
  }

  function scheduleSearch() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(search, 90);
  }

  if (input) {
    input.addEventListener('input', scheduleSearch);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        input.value = '';
        search();
      }
    });
  }

  page.querySelectorAll('[data-search-suggest]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!input) return;
      input.value = button.getAttribute('data-search-suggest') || '';
      input.focus();
      search();
    });
  });

  loadIndex();
})();
