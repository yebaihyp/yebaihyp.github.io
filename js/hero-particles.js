(function () {
  'use strict';

  var hero = document.querySelector('[data-hero]');
  var canvas = document.querySelector('[data-hero-canvas]');
  var statusEl = document.querySelector('[data-hero-status]');
  var titleEl = document.querySelector('[data-hero-title]');
  if (!hero || !canvas) return;

  var ctx = null;
  try {
    ctx = canvas.getContext('2d', { alpha: true });
  } catch (error) {}

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionEnabled = hero.dataset.motion !== 'false';
  var showFps = hero.dataset.showFps !== 'false';
  var lightQuery = window.matchMedia('(prefers-color-scheme: light)');

  var CONNECT_DISTANCE = 120;
  var CONNECT_ALPHA = 0.22;
  var LINE_WIDTH = 0.5;
  var TAU = Math.PI * 2;

  var width = 1;
  var height = 1;
  var dpr = 1;
  var particles = [];
  var blooms = [];
  var curtains = [];
  var time = 0;
  var lastTime = 0;
  var running = false;
  var raf = 0;
  var visible = true;
  var fpsFrames = 0;
  var fpsStarted = 0;
  var currentFps = 0;
  var lastStatus = '';
  var lightSpring = makeSpring(isLightTheme() ? 1 : 0, 70, 18);
  var pointer = {
    x: makeSpring(0, 115, 17),
    y: makeSpring(0, 115, 17)
  };
  var scrollSpring = makeSpring(0, 80, 19);

  function makeSpring(value, stiffness, damping) {
    return { value: value, target: value, velocity: 0, stiffness: stiffness, damping: damping };
  }

  function stepSpring(spring, dt) {
    var force = -spring.stiffness * (spring.value - spring.target) - spring.damping * spring.velocity;
    spring.velocity += force * dt;
    spring.value += spring.velocity * dt;
    return spring.value;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ||
      document.documentElement.getAttribute('data-user-color-scheme') === 'light' ||
      (!document.documentElement.getAttribute('data-theme') && lightQuery.matches);
  }

  function setStatus(text) {
    if (statusEl && statusEl.textContent !== text) {
      statusEl.textContent = text;
      lastStatus = text;
    }
  }

  function markFallback(text) {
    hero.classList.remove('is-particles', 'is-ready', 'is-static');
    hero.classList.add('is-fallback');
    setStatus(text);
    if (titleEl) titleEl.style.transform = '';
  }

  function buildCurtains() {
    var count = width < 620 ? 5 : 7;
    curtains = [];
    for (var i = 0; i < count; i += 1) {
      curtains.push({
        x: 0.04 + (i / (count - 1)) * 0.92 + rand(-0.03, 0.03),
        phase: rand(0, TAU)
      });
    }
  }

  function makeParticle(bloom, index) {
    var ribbon = index % curtains.length;
    var curtain = curtains[ribbon];
    var baseX = clamp(curtain.x * width + rand(-0.05, 0.05) * width, 0, width);
    var y = bloom ? rand(0.22, 0.82) * height : rand(0.02, 0.98) * height;
    var hue = 158 + 118 * (baseX / width) + rand(-15, 15);
    var radius = bloom ? rand(220, 430) : rand(16, 64);
    var alpha = bloom ? rand(0.05, 0.13) : rand(0.22, 0.54);

    return {
      x: baseX,
      baseX: baseX,
      wrapX: 0,
      y: y,
      vy: -rand(0.02, 0.1),
      hue: hue,
      sat: rand(78, 100),
      light: rand(64, 82),
      radius: radius,
      alpha: alpha,
      phase: curtain.phase + rand(-0.32, 0.32),
      amp: rand(14, 44),
      drift: rand(-4, 4),
      ribbon: ribbon,
      stretch: bloom ? rand(1.8, 2.6) : 1,
      bloom: Boolean(bloom)
    };
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, width < 620 ? 1.4 : 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    buildCurtains();
    particles = [];
    blooms = [];
    var count = Math.round(clamp(width / 6.2, width < 620 ? 80 : 120, 240));
    var bloomCount = width < 620 ? 8 : 13;
    var i;

    for (i = 0; i < count; i += 1) {
      particles.push(makeParticle(false, i));
    }
    for (i = 0; i < bloomCount; i += 1) {
      blooms.push(makeParticle(true, i));
    }
  }

  function updateParticles(dt) {
    var light = lightSpring.value;
    for (var i = 0; i < particles.length; i += 1) {
      var particle = particles[i];
      particle.y += particle.vy * dt;
      if (particle.y < -particle.radius - 24) particle.y = height + particle.radius + 24;
      else if (particle.y > height + particle.radius + 24) particle.y = -particle.radius - 24;

      var wave = Math.sin(particle.y * 0.012 + time * 0.35 + particle.phase) * particle.amp;
      var ribbonDrift = Math.sin(time * 0.06 + particle.ribbon * 1.35) * 15;
      var rawX = particle.baseX + wave + particle.drift + ribbonDrift + particle.wrapX;
      var margin = particle.radius + 24;
      if (rawX < -margin) {
        particle.wrapX += width + margin * 2;
        rawX = particle.baseX + wave + particle.drift + ribbonDrift + particle.wrapX;
      } else if (rawX > width + margin) {
        particle.wrapX -= width + margin * 2;
        rawX = particle.baseX + wave + particle.drift + ribbonDrift + particle.wrapX;
      }
      particle.x = rawX;

      particle.drawAlpha = particle.alpha * (1 - light * 0.42);
      particle.drawLight = particle.light - light * 12;
    }

    for (var j = 0; j < blooms.length; j += 1) {
      var bloom = blooms[j];
      bloom.y += bloom.vy * 0.25 * dt;
      if (bloom.y < -bloom.radius) bloom.y = height + bloom.radius;
      else if (bloom.y > height + bloom.radius) bloom.y = -bloom.radius;
      var bloomRawX = bloom.baseX + Math.sin(time * 0.045 + bloom.ribbon * 1.35) * 26 + bloom.wrapX;
      var bloomMargin = bloom.radius;
      if (bloomRawX < -bloomMargin) {
        bloom.wrapX += width + bloomMargin * 2;
        bloomRawX = bloom.baseX + Math.sin(time * 0.045 + bloom.ribbon * 1.35) * 26 + bloom.wrapX;
      } else if (bloomRawX > width + bloomMargin) {
        bloom.wrapX -= width + bloomMargin * 2;
        bloomRawX = bloom.baseX + Math.sin(time * 0.045 + bloom.ribbon * 1.35) * 26 + bloom.wrapX;
      }
      bloom.x = bloomRawX;
      bloom.drawAlpha = bloom.alpha * (1 - light * 0.5);
      bloom.drawLight = bloom.light - light * 10;
    }
  }

  function glowGradient(particle, radius, alpha, lightness) {
    var gradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, radius
    );
    gradient.addColorStop(0, 'hsla(' + particle.hue + ', 100%, ' + (lightness + 10) + '%, ' + alpha + ')');
    gradient.addColorStop(0.08, 'hsla(' + particle.hue + ', 96%, ' + lightness + '%, ' + (alpha * 0.78) + ')');
    gradient.addColorStop(0.34, 'hsla(' + particle.hue + ', 92%, ' + (lightness - 8) + '%, ' + (alpha * 0.18) + ')');
    gradient.addColorStop(1, 'hsla(' + particle.hue + ', 88%, ' + (lightness - 12) + '%, 0)');
    return gradient;
  }

  function drawBloom(particle) {
    var radius = particle.radius;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.scale(0.62, particle.stretch);
    var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, 'hsla(' + particle.hue + ', 94%, ' + (particle.drawLight + 8) + '%, ' + (particle.drawAlpha * 1.35) + ')');
    gradient.addColorStop(0.2, 'hsla(' + (particle.hue + 6) + ', 92%, ' + (particle.drawLight + 2) + '%, ' + (particle.drawAlpha * 0.82) + ')');
    gradient.addColorStop(0.56, 'hsla(' + (particle.hue - 4) + ', 90%, ' + (particle.drawLight - 6) + '%, ' + (particle.drawAlpha * 0.24) + ')');
    gradient.addColorStop(1, 'hsla(' + (particle.hue - 8) + ', 88%, ' + (particle.drawLight - 12) + '%, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawParticle(particle) {
    var radius = particle.radius;
    var alpha = particle.drawAlpha;
    ctx.fillStyle = glowGradient(particle, radius, alpha, particle.drawLight);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, TAU);
    ctx.fill();

    // A tight core keeps the glow from reading as a flat blurred disc.
    ctx.fillStyle = 'hsla(' + particle.hue + ', 100%, ' + (particle.drawLight + 16) + '%, ' + Math.min(0.95, alpha * 1.7) + ')';
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, Math.max(0.7, radius * 0.045), 0, TAU);
    ctx.fill();
  }

  function drawConnections() {
    var count = particles.length;
    var limitSq = CONNECT_DISTANCE * CONNECT_DISTANCE;
    for (var i = 0; i < count; i += 1) {
      var a = particles[i];
      for (var j = i + 1; j < count; j += 1) {
        var b = particles[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var distanceSq = dx * dx + dy * dy;
        if (distanceSq >= limitSq) continue;
        var distance = Math.sqrt(distanceSq);
        var alpha = (1 - distance / CONNECT_DISTANCE) * CONNECT_ALPHA;
        var hue = (a.hue + b.hue) * 0.5;
        var light = (a.drawLight + b.drawLight) * 0.5;
        ctx.strokeStyle = 'hsla(' + hue + ', ' + ((a.sat + b.sat) * 0.5) + '%, ' + (light - 5) + '%, ' + alpha + ')';
        ctx.lineWidth = LINE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(0, -scrollSpring.value * 10);

    for (var b = 0; b < blooms.length; b += 1) {
      drawBloom(blooms[b]);
    }

    drawConnections();

    for (var i = 0; i < particles.length; i += 1) {
      drawParticle(particles[i]);
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  function tick(now) {
    if (!running) return;
    var delta = Math.max(0.001, Math.min(2, (now - lastTime) / 16.6667));
    lastTime = now;
    time += delta * 0.016;
    fpsFrames += 1;

    stepSpring(pointer.x, delta * 0.018);
    stepSpring(pointer.y, delta * 0.018);
    stepSpring(scrollSpring, delta * 0.018);
    stepSpring(lightSpring, delta * 0.018);

    updateParticles(delta);

    if (titleEl && !reduceMotion.matches) {
      titleEl.style.transform = 'translate3d(' +
        (pointer.x.value * 4.5).toFixed(2) + 'px,' +
        (pointer.y.value * 3.4).toFixed(2) + 'px,0)';
    }

    render();

    if (now - fpsStarted > 760) {
      currentFps = Math.round((fpsFrames * 1000) / (now - fpsStarted));
      fpsFrames = 0;
      fpsStarted = now;
      if (showFps) setStatus('PARTICLES / ' + currentFps + ' FPS');
    }

    raf = window.requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduceMotion.matches || !motionEnabled) return;
    running = true;
    lastTime = 0;
    fpsStarted = performance.now();
    fpsFrames = 0;
    raf = window.requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function renderStatic() {
    if (!ctx) return;
    resize();
    pointer.x.value = 0;
    pointer.y.value = 0;
    lightSpring.value = lightSpring.target;
    updateParticles(1);
    render();
    setStatus('PARTICLES / STATIC');
    if (titleEl) titleEl.style.transform = '';
  }

  function onPointerMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    var rect = hero.getBoundingClientRect();
    pointer.x.target = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    pointer.y.target = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  }

  function onPointerLeave() {
    pointer.x.target = 0;
    pointer.y.target = 0;
  }

  function onThemeChange() {
    lightSpring.target = isLightTheme() ? 1 : 0;
    if (reduceMotion.matches) {
      lightSpring.value = lightSpring.target;
      renderStatic();
    }
  }

  function onScroll() {
    var maxScroll = Math.max(1, hero.offsetHeight * 0.9);
    scrollSpring.target = clamp(window.scrollY / maxScroll, 0, 1);
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else if (visible && !reduceMotion.matches && motionEnabled) start();
  }

  if (!ctx) {
    markFallback('CSS / FALLBACK');
    return;
  }

  if (navigator.connection && navigator.connection.saveData) {
    markFallback('CSS / DATA-SAVER');
    return;
  }

  if (!motionEnabled) {
    markFallback('CSS / STATIC');
    return;
  }

  resize();
  lightSpring.value = lightSpring.target;
  hero.classList.add('is-particles', 'is-ready');
  setStatus(showFps ? 'PARTICLES / BOOT' : 'PARTICLES');

  if (reduceMotion.matches) {
    renderStatic();
  } else {
    updateParticles(1);
    render();
    start();
  }

  hero.addEventListener('pointermove', onPointerMove, { passive: true });
  hero.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('visibilitychange', onVisibilityChange);

  if (window.ResizeObserver) {
    var resizeTimer = 0;
    var observer = new ResizeObserver(function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resize();
        if (reduceMotion.matches) renderStatic();
      }, 180);
    });
    observer.observe(hero);
  } else {
    window.addEventListener('resize', function () {
      resize();
      if (reduceMotion.matches) renderStatic();
    }, { passive: true });
  }

  if (window.IntersectionObserver) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        if (!reduceMotion.matches && motionEnabled) start();
      } else {
        stop();
      }
    }, { threshold: 0.01 });
    visibilityObserver.observe(hero);
  }

  if (window.MutationObserver) {
    new MutationObserver(onThemeChange).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-user-color-scheme']
    });
  }

  if (typeof reduceMotion.addEventListener === 'function') {
    reduceMotion.addEventListener('change', function () {
      if (reduceMotion.matches) {
        stop();
        renderStatic();
      } else {
        start();
      }
    });
  }

  window.__lokeParticles = {
    get count() { return particles.length; },
    get fps() { return currentFps; },
    get lastStatus() { return lastStatus; },
    get state() { return running ? 'running' : 'idle'; }
  };
})();
