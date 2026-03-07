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


  /* =========================================================
     2. STATO RUNTIME
     ========================================================= */

  // Ultima posizione verticale registrata
  var lastY = window.pageYOffset || 0;

  // True quando il cursore è nella reveal zone top
  var hoverReveal = false;

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

  // Non confrontiamo solo scrollY:
  // verifichiamo se la sezione è già quella "attiva" nel viewport alto
  function getCurrentSectionId() {
  var y = window.pageYOffset || 0;

  // Top page: consideriamo attiva la home
  if (y <= 8) return 'home';

  var ids = ['home', 'whyvn', 'services', 'owm', 'whywork', 'faq', 'contact'];
  var probeY = isDesktop() ? 120 : 96; // linea virtuale vicino al top viewport

  for (var i = ids.length - 1; i >= 0; i--) {
    var el = findTarget(ids[i]);
    if (!el) continue;

    var rect = el.getBoundingClientRect();
    if (rect.top <= probeY) {
      return ids[i];
    }
  }

  return null;
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
    
    if (isAlreadyAtTargetId(id)) {
      return;
    }

    hoverReveal = false;
    anchorJumpLock = true;

    // Landing anchor: navbar nascosta
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

        animateScrollTo(y, function () {
          lastY = window.pageYOffset || 0;

          // Piccolo ritardo prima di sbloccare navbar logic
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
      // In top page la navbar deve essere visibile
      if (y <= 8) {
        showNav();
        lastY = y;
        return;
      }

      // Scroll up => mostra navbar
      if (delta < 0) {
        showNav();
      }
      // Scroll down => nasconde navbar, salvo hoverReveal attivo
      else if (!hoverReveal) {
        hideNav();
      }
    } else {
      // Mobile: niente hover logic
      // top o scroll up => mostra
      // scroll down => nasconde
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

  // Fallback: se il mouse entra nei primi 24px, mostra navbar
  function onMouseMove(e) {
    if (!isDesktop()) return;
    if ((window.pageYOffset || 0) <= 8) return;
    if (anchorJumpLock || isAnimating) return;

    if (e.clientY <= REVEAL_ZONE) {
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

  // Cambio hash manuale / browser navigation
  window.addEventListener('hashchange', jumpToHash);

  // Load iniziale
  window.addEventListener('load', function () {
    bindRevealZone();
    syncInitialNavState();

    if (location.hash) {
      jumpToHash();
    }
  });

  // Click su link anchor interni
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;

    var href = a.getAttribute('href');
    if (!href || href.length < 2) return;

    var id = href.slice(1);
    var target = findTarget(id);
    if (!target) return;

    // Se clicchi la sezione già attiva, non succede niente
    if (isAlreadyAtTargetId(id)) {
      e.preventDefault();
      return;
    }
    
    e.preventDefault();

    // Aggiorna hash solo se cambia davvero
    if (location.hash !== '#' + id) {
      history.replaceState(null, '', '#' + id);
    }

    jumpToHash();
  }, true);

  // Scroll / mousemove / resize
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('resize', onResize);

})();
