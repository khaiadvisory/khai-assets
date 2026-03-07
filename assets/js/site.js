(function () {
  var NAV_H = 96;
  var REVEAL_ZONE = 24;
  var DESKTOP_MIN = 1024;

  var MIN_DURATION = 620;
  var MAX_DURATION = 1350;
  var DISTANCE_DIVISOR = 1.9;
  var REINFORCE_MS = 160;
  var SCROLL_DELTA = 8;

  var lastY = window.pageYOffset || 0;
  var hoverReveal = false;
  var isAnimating = false;
  var anchorJumpLock = false;

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

  function syncInitialNavState() {
    var y = window.pageYOffset || 0;

    if (y <= 8) {
      showNav();
      return;
    }

    if (isDesktop()) {
      hideNav();
    } else {
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
      if (!isAnimating) {
        window.scrollTo(0, targetY);
      }
    }, REINFORCE_MS);
  }

  function getRawTargetY(el) {
    var y = el.getBoundingClientRect().top + (window.pageYOffset || 0);
    if (y < 0) y = 0;
    return y;
  }

  function jumpToHash() {
    var id = (location.hash || '').slice(1);
    var el = findTarget(id);
    if (!el) return;

    hoverReveal = false;
    anchorJumpLock = true;

    // Anchor landing must always end with navbar hidden
    hideNav();

    // Wait for layout to settle after padding-top change
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var target = findTarget(id);
        if (!target) {
          anchorJumpLock = false;
          return;
        }

        var y = getRawTargetY(target);

        animateScrollTo(y, function () {
          lastY = window.pageYOffset || 0;

          setTimeout(function () {
            anchorJumpLock = false;
          }, 140);
        });
      });
    });
  }

  function onScroll() {
    var y = window.pageYOffset || 0;
    var delta = y - lastY;

    if (Math.abs(delta) < SCROLL_DELTA) return;

    if (anchorJumpLock || isAnimating) {
      lastY = y;
      return;
    }

    if (isDesktop()) {
      if (y <= 8) {
        showNav();
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
      if (anchorJumpLock || isAnimating) return;

      hoverReveal = true;
      showNav();
    });

    zone.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      hoverReveal = false;
    });
  }

  function onMouseMove(e) {
    if (!isDesktop()) return;
    if ((window.pageYOffset || 0) <= 8) return;
    if (anchorJumpLock || isAnimating) return;

    if (e.clientY <= REVEAL_ZONE) {
      hoverReveal = true;
      showNav();
    }
  }

  function onResize() {
    hoverReveal = false;
    syncInitialNavState();
    lastY = window.pageYOffset || 0;
  }

  window.addEventListener('hashchange', jumpToHash);

  window.addEventListener('load', function () {
    bindRevealZone();
    syncInitialNavState();

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
