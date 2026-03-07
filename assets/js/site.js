(function () {
  var NAV_H = 96;
  var REVEAL_ZONE = 24;
  var DESKTOP_MIN = 1024;

  var MIN_DURATION = 620;
  var MAX_DURATION = 1350;
  var DISTANCE_DIVISOR = 1.9;
  var REINFORCE_MS = 160;

  var lastY = window.pageYOffset || 0;
  var hoverReveal = false;
  var isAnimating = false;
  var anchorLandingLock = false;

  function isDesktop() {
    return window.innerWidth >= DESKTOP_MIN;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function findTarget(id) {
    if (!id) return null;
    return document.getElementById(id);
  }

  function easeInOutExpoSoft(t) {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }

  function getDuration(distance) {
    return clamp(
      MIN_DURATION + Math.abs(distance) / DISTANCE_DIVISOR,
      MIN_DURATION,
      MAX_DURATION
    );
  }

  function navIsShown() {
    return !document.body.classList.contains('nav-hidden');
  }

  function showNav() {
    document.body.classList.remove('nav-hidden');
    document.body.classList.add('nav-revealed');
    document.body.style.paddingTop = NAV_H + 'px';
  }

  function hideNav() {
    document.body.classList.remove('nav-revealed');
    document.body.classList.add('nav-hidden');
    document.body.style.paddingTop = '0px';
  }

  function syncNavForTop() {
    if ((window.pageYOffset || 0) <= 8) {
      showNav();
    }
  }

  function animateScrollTo(targetY, onDone) {
    var startY = window.pageYOffset || 0;
    var diff = targetY - startY;

    if (Math.abs(diff) < 2) {
      if (onDone) onDone();
      return;
    }

    var duration = getDuration(diff);
    var startTime = performance.now();
    isAnimating = true;

    function step(now) {
      var elapsed = now - startTime;
      var t = clamp(elapsed / duration, 0, 1);
      var eased = easeInOutExpoSoft(t);
      var y = startY + diff * eased;

      window.scrollTo(0, y);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        isAnimating = false;
        if (onDone) onDone();
      }
    }

    requestAnimationFrame(step);

    setTimeout(function () {
      if (!isAnimating) window.scrollTo(0, targetY);
    }, REINFORCE_MS);
  }

  function getAnchorOffset(rawY) {
    var currentY = window.pageYOffset || 0;
    var fromTop = currentY < 40;
    var goingDown = rawY > currentY;

    if (fromTop) return 0;
    if (goingDown) return 0;
    return NAV_H;
  }

  function jumpToHash() {
    var id = (location.hash || '').slice(1);
    var el = findTarget(id);
    if (!el) return;

    var rawY = el.getBoundingClientRect().top + (window.pageYOffset || 0);
    var offset = getAnchorOffset(rawY);
    var y = rawY - offset;
    if (y < 0) y = 0;

    if (isDesktop()) {
      hideNav();
      anchorLandingLock = true;
    }

    animateScrollTo(y, function () {
      lastY = window.pageYOffset || 0;
      setTimeout(function () {
        anchorLandingLock = false;
      }, 120);
    });
  }

  function onScroll() {
    var y = window.pageYOffset || 0;
    var delta = y - lastY;

    if (Math.abs(delta) < 6) return;

    if (isDesktop()) {
      if (y <= 8) {
        showNav();
        lastY = y;
        return;
      }

      if (anchorLandingLock || isAnimating) {
        lastY = y;
        return;
      }

      if (delta < 0) {
        showNav();
      } else if (!hoverReveal) {
        hideNav();
      }
    } else {
      if (y <= 8 || delta < 0) {
        showNav();
      } else {
        hideNav();
      }
    }

    lastY = y;
  }

  function bindRevealZone() {
    var zone = document.querySelector('.nav-reveal-zone');
    if (!zone) return;

    zone.addEventListener('mouseenter', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;

      hoverReveal = true;
      showNav();
    });

    zone.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;

      hoverReveal = false;

      if ((window.pageYOffset || 0) > 8) {
        hideNav();
      }
    });
  }

  function onMouseMove(e) {
    if (!isDesktop()) return;
    if ((window.pageYOffset || 0) <= 8) return;

    if (e.clientY <= REVEAL_ZONE) {
      hoverReveal = true;
      showNav();
    }
  }

  function onResize() {
    hoverReveal = false;
    syncNavForTop();

    if ((window.pageYOffset || 0) > 8) {
      if (isDesktop()) {
        hideNav();
      } else {
        showNav();
      }
    }
  }

  window.addEventListener('hashchange', jumpToHash);

  window.addEventListener('load', function () {
    bindRevealZone();

    if ((window.pageYOffset || 0) <= 8) {
      showNav();
    } else if (isDesktop()) {
      hideNav();
    } else {
      showNav();
    }

    if (location.hash) {
      jumpToHash();
    }
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;

    var href = a.getAttribute('href');
    if (!href || href.length < 2) return;

    var id = href.slice(1);
    if (!findTarget(id)) return;

    e.preventDefault();
    history.replaceState(null, '', '#' + id);
    jumpToHash();
  }, true);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('resize', onResize);
})();
