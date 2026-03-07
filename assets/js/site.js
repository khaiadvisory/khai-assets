(function () {
       /* =========================================================
     1. CONFIG / COSTANTI PRINCIPALI
     ========================================================= */

  // Altezza navbar desktop
  var NAV_H = 96;

  // Fascia invisibile in alto che fa riapparire la navbar su desktop
  var REVEAL_ZONE = 24;

  // Soglia desktop/mobile
  var DESKTOP_MIN = 1024;

  // Parametri smooth scroll anchor
  var MIN_DURATION = 620;
  var MAX_DURATION = 1350;
  var DISTANCE_DIVISOR = 1.9;
  var REINFORCE_MS = 160;

  // Soglia minima per considerare lo scroll "reale"
  var SCROLL_DELTA = 8;

  // Versioning / cache-busting marker
  var SITE_JS_VERSION = 'debug-05';

  // Espone subito la versione caricata
  window.__KHAI_NAV_VERSION = SITE_JS_VERSION;
  console.log('[KHAI NAV DEBUG] site.js version = ' + SITE_JS_VERSION);


    /* =========================================================
     2. STATO RUNTIME
     ========================================================= */

  // Ultima posizione verticale registrata
  var lastY = window.pageYOffset || 0;

  // True quando la navbar è stata richiamata via hover/reveal
  var hoverReveal = false;

  // True mentre il cursore è sopra l'header/navbar
  var navHoverActive = false;

  // Timer per evitare chiusure troppo brusche
  var revealHideTimer = null;

  // True mentre è in corso l'animazione smooth scroll
  var isAnimating = false;

  // Lock temporaneo durante i salti anchor
  // Serve per evitare che la navbar cambi stato durante il landing
  var anchorJumpLock = false;


  /* =========================================================
     3. UTILITY DI BASE
     ========================================================= */

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


  /* =========================================================
     4. EASING + DURATA ANIMAZIONE SCROLL
     ========================================================= */

  // Easing morbido, più "editorial / luxury"
  function easeInOutExpoSoft(t) {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }

  // Durata dinamica in base alla distanza
  function getDuration(distance) {
    return clamp(
      MIN_DURATION + Math.abs(distance) / DISTANCE_DIVISOR,
      MIN_DURATION,
      MAX_DURATION
    );
  }


  /* =========================================================
     5. STATO VISIVO NAVBAR
     ========================================================= */

  // Mostra navbar e ripristina lo spazio top del body
  function showNav() {
    document.body.classList.remove('nav-hidden');
    document.body.classList.add('nav-revealed');
    document.body.style.paddingTop = NAV_H + 'px';
  }

  // Nasconde navbar e rimuove lo spazio top del body
  function hideNav() {
    document.body.classList.remove('nav-revealed');
    document.body.classList.add('nav-hidden');
    document.body.style.paddingTop = '0px';
  }

  // Stato iniziale:
  // - in top page: navbar visibile
  // - su desktop fuori top: navbar nascosta
  // - su mobile fuori top: navbar visibile
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


  /* =========================================================
     6. SMOOTH SCROLL VERSO TARGET
     ========================================================= */

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

    // micro-rinforzo finale contro eventuali rounding glitches
    setTimeout(function () {
      if (!isAnimating) {
        window.scrollTo(0, targetY);
      }
    }, REINFORCE_MS);
  }


  /* =========================================================
     7. CALCOLO POSIZIONE SEZIONE TARGET
     ========================================================= */

  // Restituisce la Y assoluta del top della sezione nel documento
  function getRawTargetY(el) {
    var y = el.getBoundingClientRect().top + (window.pageYOffset || 0);
    if (y < 0) y = 0;
    return y;
  }


      /* =========================================================
     8. CONTROLLO: SIAMO GIÀ NELLA SEZIONE TARGET?
     ========================================================= */

  function getSectionIds() {
    return ['home', 'whyvn', 'services', 'owm', 'whywork', 'faq', 'contact'];
  }

  function getAnchorY(id) {
    var el = findTarget(id);
    if (!el) return null;

    var y = el.getBoundingClientRect().top + (window.pageYOffset || 0);
    return y < 0 ? 0 : y;
  }

  function getSectionRanges() {
    var ids = getSectionIds();
    var ranges = [];

    for (var i = 0; i < ids.length; i++) {
      var start = getAnchorY(ids[i]);
      if (start === null) continue;

      var end = Infinity;

      for (var j = i + 1; j < ids.length; j++) {
        var nextStart = getAnchorY(ids[j]);
        if (nextStart !== null) {
          end = nextStart;
          break;
        }
      }

      ranges.push({
        id: ids[i],
        start: start,
        end: end
      });
    }

    return ranges;
  }

  function getCurrentSectionId() {
    var y = window.pageYOffset || 0;

    // In top pagina consideriamo Home attiva
    if (y <= 8) return 'home';

    // Usiamo una probe line assoluta nel documento
    var probeOffset = isDesktop() ? 120 : 96;
    var probeDocY = y + probeOffset;
    var ranges = getSectionRanges();

    for (var i = 0; i < ranges.length; i++) {
      if (probeDocY >= ranges[i].start && probeDocY < ranges[i].end) {
        return ranges[i].id;
      }
    }

    // Fallback: ultima sezione il cui start è sopra la probe line
    for (var j = ranges.length - 1; j >= 0; j--) {
      if (probeDocY >= ranges[j].start) {
        return ranges[j].id;
      }
    }

    return 'home';
  }

  function isAlreadyAtTargetId(id) {
    if (!id) return false;
    return getCurrentSectionId() === id;
  }
  
      /* =========================================================
     9. JUMP A HASH / LANDING SU SEZIONE
     ========================================================= */

  function jumpToHash() {
    var id = (location.hash || '').slice(1);
    var el = findTarget(id);
    if (!el) return;

    console.group('[KHAI NAV DEBUG] jumpToHash start');
    console.log({
      id: id,
      currentSectionId: getCurrentSectionId(),
      alreadyAtTarget: isAlreadyAtTargetId(id),
      pageYOffset: window.pageYOffset || 0,
      elementTop: el.getBoundingClientRect().top,
      elementBottom: el.getBoundingClientRect().bottom,
      bodyPaddingTop: document.body.style.paddingTop || '(empty)',
      bodyClasses: document.body.className
    });
    console.groupEnd();

    if (isAlreadyAtTargetId(id)) {
      console.group('[KHAI NAV DEBUG] jumpToHash aborted: already at target');
      console.log({
        id: id,
        currentSectionId: getCurrentSectionId(),
        pageYOffset: window.pageYOffset || 0,
        locationHash: location.hash
      });
      console.groupEnd();
      return;
    }

    hoverReveal = false;
    anchorJumpLock = true;

    // HOME = caso speciale:
    // la navbar deve restare sempre visibile e fissa
    if (id === 'home') {
      showNav();

      animateScrollTo(0, function () {
        showNav();
        lastY = window.pageYOffset || 0;

        console.group('[KHAI NAV DEBUG] jumpToHash finished (home)');
        console.log({
          id: id,
          finalPageYOffset: window.pageYOffset || 0,
          currentSectionId: getCurrentSectionId(),
          bodyPaddingTop: document.body.style.paddingTop || '(empty)',
          bodyClasses: document.body.className
        });
        console.groupEnd();

        setTimeout(function () {
          showNav();
          anchorJumpLock = false;
        }, 140);
      });

      return;
    }

    // Tutte le altre sezioni: navbar nascosta al landing
    hideNav();

    // Aspettiamo 2 frame per stabilizzare il layout
    // dopo il cambio di padding-top del body
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var target = findTarget(id);
        if (!target) {
          anchorJumpLock = false;
          return;
        }

        var y = getRawTargetY(target);

        console.group('[KHAI NAV DEBUG] jump target computed');
        console.log({
          id: id,
          rawTargetY: y,
          currentPageYOffset: window.pageYOffset || 0,
          targetRectTop: target.getBoundingClientRect().top,
          targetRectBottom: target.getBoundingClientRect().bottom,
          bodyPaddingTop: document.body.style.paddingTop || '(empty)',
          bodyClasses: document.body.className
        });
        console.groupEnd();

        animateScrollTo(y, function () {
          lastY = window.pageYOffset || 0;

          console.group('[KHAI NAV DEBUG] jumpToHash finished');
          console.log({
            id: id,
            finalPageYOffset: window.pageYOffset || 0,
            currentSectionId: getCurrentSectionId(),
            bodyPaddingTop: document.body.style.paddingTop || '(empty)',
            bodyClasses: document.body.className
          });
          console.groupEnd();

          setTimeout(function () {
            anchorJumpLock = false;
          }, 140);
        });
      });
    });
  }

   /* =========================================================
     10. LOGICA NAVBAR SU SCROLL
     ========================================================= */

  function onScroll() {
    var y = window.pageYOffset || 0;
    var delta = y - lastY;

    if (Math.abs(delta) < SCROLL_DELTA) return;

    // Durante anchor jump / animazione non tocchiamo navbar state
    if (anchorJumpLock || isAnimating) {
      lastY = y;
      return;
    }

    if (isDesktop()) {
      // In top page la navbar deve essere sempre visibile e stabile
      if (y <= 8) {
        clearRevealHideTimer();
        hoverReveal = false;
        navHoverActive = false;
        showNav();
        lastY = y;
        return;
      }

      // Hover reale nel DOM: più affidabile degli stati storici
      var liveHover = isHeaderHovered() || isRevealZoneHovered() || navHoverActive;

      // Scroll up => mostra navbar
      if (delta < 0) {
        clearRevealHideTimer();
        showNav();
      }
      // Scroll down => nasconde navbar se non siamo davvero in hover
      else {
        if (!liveHover) {
          clearRevealHideTimer();
          hoverReveal = false;
          navHoverActive = false;
          hideNav();
        }
      }
    } else {
      // Mobile: niente hover logic
      if (y <= 8 || delta < 0) {
        showNav();
      } else {
        hideNav();
      }
    }

    lastY = y;
  }


     /* =========================================================
     11. REVEAL ZONE DESKTOP
     ========================================================= */

  function clearRevealHideTimer() {
    if (revealHideTimer) {
      clearTimeout(revealHideTimer);
      revealHideTimer = null;
    }
  }

  function isHeaderHovered() {
    var header = document.querySelector('.site-header');
    return !!(header && header.matches(':hover'));
  }

  function isRevealZoneHovered() {
    var zone = document.querySelector('.nav-reveal-zone');
    return !!(zone && zone.matches(':hover'));
  }

  function scheduleRevealHide() {
    clearRevealHideTimer();

    revealHideTimer = setTimeout(function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      // Se il cursore è davvero ancora sulla zona/header, non chiudere
      if (isHeaderHovered() || isRevealZoneHovered() || navHoverActive) {
        return;
      }

      hoverReveal = false;
      navHoverActive = false;

      if (getCurrentSectionId() !== 'home') {
        hideNav();
      } else {
        showNav();
      }
    }, 180);
  }

  function bindRevealZone() {
    var zone = document.querySelector('.nav-reveal-zone');
    var header = document.querySelector('.site-header');

    if (!zone || !header) return;

    // Entrando nella trigger zone: mostra navbar
    zone.addEventListener('mouseenter', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      clearRevealHideTimer();
      hoverReveal = true;
      showNav();
    });

    // Uscendo dalla trigger zone: non chiudere subito,
    // potremmo stare entrando nell'header
    zone.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      scheduleRevealHide();
    });

    // Finché il cursore è sopra la navbar, resta aperta
    header.addEventListener('mouseenter', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      clearRevealHideTimer();
      navHoverActive = true;
      hoverReveal = true;
      showNav();
    });

    // Quando esci dalla navbar, chiudi con un piccolo delay
    header.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      navHoverActive = false;
      scheduleRevealHide();
    });
  }

  // Fallback: se il mouse entra nei primi 24px, mostra navbar
  function onMouseMove(e) {
    if (!isDesktop()) return;
    if ((window.pageYOffset || 0) <= 8) return;
    if (anchorJumpLock || isAnimating) return;

    if (e.clientY <= REVEAL_ZONE) {
      clearRevealHideTimer();
      hoverReveal = true;
      showNav();
    }
  }


  /* =========================================================
     12. RESIZE
     ========================================================= */

  function onResize() {
    hoverReveal = false;
    syncInitialNavState();
    lastY = window.pageYOffset || 0;
  }


        /* =========================================================
     13. EVENT LISTENERS GLOBALI
     ========================================================= */

  function debugNavClick(label, data) {
    console.group('[KHAI NAV DEBUG] ' + label);
    console.log(data);
    console.groupEnd();
  }

  // Load iniziale
  window.addEventListener('load', function () {
    bindRevealZone();
    syncInitialNavState();

    debugNavClick('load state', {
      version: window.__KHAI_NAV_VERSION,
      locationHash: location.hash,
      currentSectionId: getCurrentSectionId(),
      pageYOffset: window.pageYOffset || 0,
      ranges: getSectionRanges()
    });

    if (location.hash) {
      jumpToHash();
    }
  });

  // Click navbar gestiti solo via data-nav-target
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-nav-target]');
    if (!a) return;

    var id = a.getAttribute('data-nav-target');
    if (!id) return;

    var target = findTarget(id);
    if (!target) return;

    debugNavClick('before click decision', {
      version: window.__KHAI_NAV_VERSION,
      id: id,
      locationHash: location.hash,
      currentSectionId: getCurrentSectionId(),
      alreadyAtTarget: isAlreadyAtTargetId(id),
      pageYOffset: window.pageYOffset || 0,
      ranges: getSectionRanges()
    });

    // Blocca qualsiasi comportamento nativo / altri handler
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    // Se clicchi la sezione già attiva, non succede niente
    if (isAlreadyAtTargetId(id)) {
      debugNavClick('blocked: already at target', {
        id: id,
        currentSectionId: getCurrentSectionId(),
        pageYOffset: window.pageYOffset || 0,
        ranges: getSectionRanges()
      });
      return;
    }

    if (location.hash !== '#' + id) {
      history.replaceState(null, '', '#' + id);
    }

    debugNavClick('jumpToHash will run', {
      id: id,
      currentSectionId: getCurrentSectionId(),
      locationHash: location.hash,
      pageYOffset: window.pageYOffset || 0,
      ranges: getSectionRanges()
    });

    jumpToHash();
  }, true);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('resize', onResize);

})();
