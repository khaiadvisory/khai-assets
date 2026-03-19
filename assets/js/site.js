(function () {
       /* =========================================================
     1. CONFIG / COSTANTI PRINCIPALI
     ========================================================= */

    // Fallback height usata per desktop e come sicurezza generale
  var NAV_H_FALLBACK = 96;

  // Fascia invisibile in alto che fa riapparire la navbar su desktop
  var REVEAL_ZONE = 24;

  // Soglia desktop/mobile
  var DESKTOP_MIN = 1024;

  // Parametri smooth scroll anchor
 var MIN_DURATION = 320;
var MAX_DURATION = 760;
var DISTANCE_DIVISOR = 3.2;
var REINFORCE_MS = 90;

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

  // Mobile-only special target for OWM:
  // on smartphone we land on the visible title block,
  // not on the section wrapper top.
  if (!isDesktop() && id === 'owm') {
    var owmTitleCol = document.querySelector('#owm .ka-owm__titlecol');
    if (owmTitleCol) return owmTitleCol;
  }

  return document.getElementById(id);
}
  function getHeaderHeight() {
    var header = document.querySelector('.site-header');
    if (!header) return NAV_H_FALLBACK;

    var h = header.getBoundingClientRect().height;
    if (!h || h < 1) return NAV_H_FALLBACK;

    return Math.round(h);
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
    var navH = isDesktop() ? NAV_H_FALLBACK : getHeaderHeight();
    document.body.classList.remove('nav-hidden');
    document.body.classList.add('nav-revealed');
    document.body.style.paddingTop = navH + 'px';
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

function getJumpTargetY(el) {
  var rawY = getRawTargetY(el);

  // Desktop: comportamento storico invariato
  if (isDesktop()) {
    return rawY;
  }

  // Mobile: compensiamo con l'altezza reale della navbar visibile
  var navH = getHeaderHeight();
  var y = rawY - navH;

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

    // Desktop invariato; mobile coerente con l'altezza reale della navbar
    var navH = isDesktop() ? NAV_H_FALLBACK : getHeaderHeight();
    var probeOffset = isDesktop() ? 120 : navH + 12;
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

   // Tutte le altre sezioni
  // Desktop: comportamento storico invariato
  if (isDesktop()) {
    hideNav();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var target = findTarget(id);
        if (!target) {
          anchorJumpLock = false;
          return;
        }

        var y = getJumpTargetY(target);

        console.group('[KHAI NAV DEBUG] jump target computed (desktop)');
        console.log({
          id: id,
          jumpTargetY: y,
          currentPageYOffset: window.pageYOffset || 0,
          targetRectTop: target.getBoundingClientRect().top,
          targetRectBottom: target.getBoundingClientRect().bottom,
          headerHeight: getHeaderHeight(),
          bodyPaddingTop: document.body.style.paddingTop || '(empty)',
          bodyClasses: document.body.className
        });
        console.groupEnd();

        animateScrollTo(y, function () {
          lastY = window.pageYOffset || 0;

          console.group('[KHAI NAV DEBUG] jumpToHash finished (desktop)');
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

    return;
  }

  // Mobile: navbar visibile e landing compensato
  showNav();

  requestAnimationFrame(function () {
    var target = findTarget(id);
    if (!target) {
      anchorJumpLock = false;
      return;
    }

    var y = getJumpTargetY(target);

    console.group('[KHAI NAV DEBUG] jump target computed (mobile)');
    console.log({
      id: id,
      jumpTargetY: y,
      currentPageYOffset: window.pageYOffset || 0,
      targetRectTop: target.getBoundingClientRect().top,
      targetRectBottom: target.getBoundingClientRect().bottom,
      headerHeight: getHeaderHeight(),
      bodyPaddingTop: document.body.style.paddingTop || '(empty)',
      bodyClasses: document.body.className
    });
    console.groupEnd();

    animateScrollTo(y, function () {
      showNav();
      lastY = window.pageYOffset || 0;

      console.group('[KHAI NAV DEBUG] jumpToHash finished (mobile)');
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

  function shouldKeepNavVisibleFromPointer(e) {
    if (!e) return false;

    // Mouse fuori dal viewport verso l'alto:
    // la navbar deve restare visibile
    if (e.clientY < 0) return true;

    // Mouse ancora dentro / sopra la trigger zone
    if (e.clientY <= REVEAL_ZONE) return true;

    // Mouse sopra l'header/navbar
    if (isHeaderHovered()) return true;

    // Mouse sopra la reveal zone
    if (isRevealZoneHovered()) return true;

    return false;
  }

  function scheduleRevealHide() {
    clearRevealHideTimer();

    revealHideTimer = setTimeout(function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

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
    }, 150);
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

    // Uscendo dalla trigger zone: non chiudere subito.
    // La chiusura sarà decisa dal mousemove in base alla Y reale del cursore.
    zone.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      clearRevealHideTimer();
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

    // Quando esci dalla navbar, non chiudere subito:
    // decide il mousemove se il cursore è davvero sceso sotto la trigger zone
    header.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;
      if ((window.pageYOffset || 0) <= 8) return;
      if (anchorJumpLock || isAnimating) return;

      navHoverActive = false;
      clearRevealHideTimer();
    });
  }

  // Mousemove = sorgente principale di stabilità desktop
  function onMouseMove(e) {
    if (!isDesktop()) return;
    if ((window.pageYOffset || 0) <= 8) return;
    if (anchorJumpLock || isAnimating) return;

    // Se il cursore è nella zona alta o sopra l'header,
    // la navbar resta visibile
    if (shouldKeepNavVisibleFromPointer(e)) {
      clearRevealHideTimer();
      hoverReveal = true;
      showNav();
      return;
    }

    // La navbar si richiude solo quando il mouse è realmente
    // rientrato nel viewport sotto la trigger zone
    scheduleRevealHide();
  }

/* =========================================================
   11A. LANGUAGE SWITCH
   ========================================================= */

function getLanguageMenuEls() {
  return {
    wrap: document.querySelector('.nav-lang-wrap'),
    toggle: document.querySelector('.nav-lang-toggle'),
    menu: document.getElementById('navLangMenu')
  };
}

function openLanguageMenu() {
  var els = getLanguageMenuEls();
  if (!els.toggle || !els.menu) return;

  els.menu.hidden = false;
  els.toggle.setAttribute('aria-expanded', 'true');
}

function closeLanguageMenu() {
  var els = getLanguageMenuEls();
  if (!els.toggle || !els.menu) return;

  els.menu.hidden = true;
  els.toggle.setAttribute('aria-expanded', 'false');
}

function toggleLanguageMenu() {
  var els = getLanguageMenuEls();
  if (!els.toggle || !els.menu) return;

  var isOpen = els.toggle.getAttribute('aria-expanded') === 'true';

  if (isOpen) {
    closeLanguageMenu();
  } else {
    openLanguageMenu();
  }
}

function bindLanguageMenu() {
  var els = getLanguageMenuEls();
  if (!els.wrap || !els.toggle || !els.menu) return;

  closeLanguageMenu();

  els.toggle.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    toggleLanguageMenu();
  });

  els.menu.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;

    closeLanguageMenu();
  });

  document.addEventListener('click', function (e) {
    var currentEls = getLanguageMenuEls();
    if (!currentEls.wrap || !currentEls.menu) return;

    if (currentEls.wrap.contains(e.target)) return;

    closeLanguageMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeLanguageMenu();
    }
  });
}

  /* =========================================================
     11B. CONTACT MODAL
     ========================================================= */

  var CONTACT_WORKER_URL = 'https://khai-contact-form.paolo-testa01.workers.dev';

var CONTACT_I18N = {
  en: {
    send: 'Send',
    sending: 'Sending...',
    required: 'Please complete Name, Email, and Message.',
    invalidEmail: 'Please enter a valid email address.',
    sendErrorFallback: 'Unable to send message.',
    sendSuccess: 'Message sent successfully.',
    sendErrorNow: 'Unable to send message right now. Please try again in a moment.'
  },
  it: {
    send: 'Invia',
    sending: 'Invio in corso...',
    required: 'Compila Nome, Email e Messaggio.',
    invalidEmail: 'Inserisci un indirizzo email valido.',
    sendErrorFallback: 'Impossibile inviare il messaggio.',
    sendSuccess: 'Messaggio inviato con successo.',
    sendErrorNow: 'Impossibile inviare il messaggio in questo momento. Riprova tra poco.'
  },
  de: {
    send: 'Senden',
    sending: 'Wird gesendet...',
    required: 'Bitte füllen Sie Name, E-Mail und Nachricht aus.',
    invalidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    sendErrorFallback: 'Nachricht konnte nicht gesendet werden.',
    sendSuccess: 'Nachricht erfolgreich gesendet.',
    sendErrorNow: 'Die Nachricht kann im Moment nicht gesendet werden. Bitte versuchen Sie es in Kürze erneut.'
  }
};

function getContactLocale() {
  var htmlLang = '';
  try {
    htmlLang = String((document.documentElement && document.documentElement.lang) || '')
      .trim()
      .toLowerCase();
  } catch (e) {}

  if (htmlLang === 'en' || htmlLang === 'it' || htmlLang === 'de') {
    return htmlLang;
  }

  var toggleLabel = '';
  try {
    var toggleEl = document.querySelector('.nav-lang-toggle__label');
    toggleLabel = String((toggleEl && toggleEl.textContent) || '')
      .trim()
      .toLowerCase();
  } catch (e) {}

  if (toggleLabel === 'en' || toggleLabel === 'it' || toggleLabel === 'de') {
    return toggleLabel;
  }

  var activeLang = '';
  try {
    var activeEl = document.querySelector('.nav-lang-menu a.is-active, .nav-lang-menu a[aria-current="page"]');
    activeLang = String((activeEl && activeEl.textContent) || '')
      .trim()
      .toLowerCase();
  } catch (e) {}

  if (activeLang === 'english') return 'en';
  if (activeLang === 'italiano') return 'it';
  if (activeLang === 'deutsch') return 'de';

  var host = '';
  try {
    host = String((window.location && window.location.hostname) || '')
      .trim()
      .toLowerCase();
  } catch (e) {}

  if (host.indexOf('de.') === 0) return 'de';
  if (host.indexOf('it.') === 0) return 'it';

  return 'en';
}

function getContactStrings() {
  var locale = getContactLocale();
  return CONTACT_I18N[locale] || CONTACT_I18N.en;
}

  function getContactModalEls() {
    return {
      modal: document.getElementById('ka-contact-modal'),
      form: document.getElementById('ka-contact-form'),
      feedback: document.getElementById('ka-contact-feedback'),
      submit: document.getElementById('ka-contact-submit'),
      firstInput: document.getElementById('ka-name')
    };
  }

  function openContactModal() {
  var els = getContactModalEls();
  if (!els.modal) return;

  setContactFeedback('', '');

  els.modal.classList.add('is-open');
  els.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ka-modal-open');

  window.setTimeout(function () {
    if (els.firstInput) els.firstInput.focus();
  }, 40);
}

  function closeContactModal() {
  var els = getContactModalEls();
  if (!els.modal) return;

  els.modal.classList.remove('is-open');
  els.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ka-modal-open');

  setContactFeedback('', '');
  setContactSubmitting(false);
}

  function setContactFeedback(message, type) {
    var els = getContactModalEls();
    if (!els.feedback) return;

    els.feedback.textContent = message || '';
    els.feedback.classList.remove('is-error', 'is-success');

    if (type) {
      els.feedback.classList.add(type === 'success' ? 'is-success' : 'is-error');
    }
  }

  function setContactSubmitting(isSubmitting) {
  var els = getContactModalEls();
  var t = getContactStrings();
  if (!els.submit) return;

  els.submit.disabled = !!isSubmitting;
  els.submit.textContent = isSubmitting ? t.sending : t.send;
}

 function validateContactForm(data) {
  var t = getContactStrings();

  if (!data.name || !data.email || !data.message) {
    return t.required;
  }

  var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  if (!emailOk) {
    return t.invalidEmail;
  }

  return '';
}
       
 async function submitContactForm(form) {
  var formData = new FormData(form);

  var payload = {
    name: String(formData.get('name') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    company: String(formData.get('company') || '').trim(),
    website: String(formData.get('website') || '').trim(),
    message: String(formData.get('message') || '').trim(),
    companyTrap: String(formData.get('companyTrap') || '').trim()
  };

  var validationError = validateContactForm(payload);
  if (validationError) {
    setContactFeedback(validationError, 'error');
    return;
  }

  setContactFeedback('', '');
  setContactSubmitting(true);

  try {
    var res = await fetch(CONTACT_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    var json = {};
    try {
      json = await res.json();
    } catch (err) {
      json = {};
    }

    var t = getContactStrings();

    if (!res.ok || !json.ok) {
      throw new Error(json.error || t.sendErrorFallback);
    }

    form.reset();
    setContactFeedback(t.sendSuccess, 'success');

    window.setTimeout(function () {
      closeContactModal();
      setContactFeedback('', '');
    }, 900);
  } catch (error) {
    setContactFeedback(t.sendErrorNow, 'error');
  } finally {
    setContactSubmitting(false);
  }
}

function bindContactModal() {
  document.addEventListener('click', function (e) {
    var openTrigger = e.target.closest('[data-contact-open]');
    if (openTrigger) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      window.setTimeout(function () {
        openContactModal();
      }, 0);

      return;
    }

    var closeTrigger = e.target.closest('[data-contact-close]');
    if (closeTrigger) {
      var els = getContactModalEls();
      if (!els.modal || !els.modal.classList.contains('is-open')) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      closeContactModal();
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var els = getContactModalEls();
      if (els.modal && els.modal.classList.contains('is-open')) {
        closeContactModal();
      }
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.id !== 'ka-contact-form') return;

    e.preventDefault();
    submitContactForm(form);
  });
}


/* =========================================================
   11C. WHYWORK DIAGRAM: LOOP ON ENTER
   phase 0 start desktop svg
   phase 1 connector draw
   phase 2 final svg handoff
   ========================================================= */

function initWhyworkDiagramAnimation() {
  var diagram = document.querySelector('.ka-whyworkDiagram');
  if (!diagram) return;

  if (diagram.dataset.diagramBound === 'true') return;
  diagram.dataset.diagramBound = 'true';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileBreakpoint = 719;
  var totalDuration = 2300;
  var repeatDelay = 700;
  var playTimer = null;
  var loopTimer = null;
  var isLoopActive = false;

  function clearTimers() {
    if (playTimer) {
      window.clearTimeout(playTimer);
      playTimer = null;
    }
    if (loopTimer) {
      window.clearTimeout(loopTimer);
      loopTimer = null;
    }
  }

  function resetToStart() {
    clearTimers();
    diagram.classList.remove('is-armed');
    diagram.classList.remove('is-playing');
    diagram.classList.remove('is-played');
    void diagram.offsetWidth;
  }

  function finishImmediately() {
    clearTimers();
    diagram.classList.remove('is-armed');
    diagram.classList.remove('is-playing');
    diagram.classList.add('is-played');
  }

  function scheduleNextPlay() {
    if (!isLoopActive) return;

    loopTimer = window.setTimeout(function () {
      playCycle();
    }, repeatDelay);
  }

  function playCycle() {
    if (!isLoopActive) return;

    if (reduceMotion) {
      finishImmediately();
      return;
    }

    resetToStart();
    diagram.classList.add('is-armed');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!isLoopActive) return;
        diagram.classList.add('is-playing');
      });
    });

    playTimer = window.setTimeout(function () {
      if (!isLoopActive) return;

      diagram.classList.remove('is-armed');
      diagram.classList.remove('is-playing');
      diagram.classList.add('is-played');

      scheduleNextPlay();
    }, totalDuration);
  }

  function startLoop() {
    if (isLoopActive) return;
    isLoopActive = true;
    playCycle();
  }

  function stopLoop() {
    isLoopActive = false;
    resetToStart();
  }

  if (!('IntersectionObserver' in window)) {
    startLoop();
    return;
  }

  var threshold = window.innerWidth <= mobileBreakpoint ? 0.2 : 0.35;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
        startLoop();
      } else {
        stopLoop();
      }
    });
  }, {
    threshold: [0, threshold]
  });

  observer.observe(diagram);
}


  /* =========================================================
     11C. HERO VIDEO: FALLBACK TECNICO / RETE
     ========================================================= */

  function getHeroVideoEl() {
    return document.querySelector('.ka-hero__video');
  }

  function isVideoConnectionOk() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    // Se l'API non esiste, per default permettiamo il video
    if (!connection) return true;

    // Risparmio dati attivo = meglio fallback statico
    if (connection.saveData) return false;

    // Connessioni lente = meglio fallback statico
    var type = String(connection.effectiveType || '').toLowerCase();
    if (type === 'slow-2g' || type === '2g') return false;

    return true;
  }

  function canUseHeroVideo() {
    var video = getHeroVideoEl();
    if (!video) return false;

    // Se il browser non supporta davvero il tag video, niente video
    if (typeof video.play !== 'function') return false;

    // Se la connessione è sfavorevole, meglio fallback statico
    if (!isVideoConnectionOk()) return false;

    return true;
  }

  function setupHeroVideo() {
    var video = getHeroVideoEl();
    if (!video) return;

    if (!canUseHeroVideo()) {
      video.pause();
      video.removeAttribute('autoplay');
      video.style.display = 'none';
      return;
    }

    video.style.display = 'block';

    // Proviamo a forzare il play; se fallisce, resta il fallback statico
    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        video.style.display = 'none';
      });
    }
  }



  /* =========================================================
     12. RESIZE
     ========================================================= */

  function onResize() {
  hoverReveal = false;
  closeLanguageMenu();
  syncInitialNavState();
  setupHeroVideo();
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
  bindLanguageMenu();
  bindContactModal();
  initWhyworkDiagramAnimation();
  setupHeroVideo();

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

  if (location.hash !== '#' + id) {
    history.replaceState(null, '', '#' + id);
  }

  if (isAlreadyAtTargetId(id)) {
    debugNavClick('same section clicked: re-jump to section start', {
      id: id,
      currentSectionId: getCurrentSectionId(),
      pageYOffset: window.pageYOffset || 0,
      ranges: getSectionRanges()
    });
  } else {
    debugNavClick('jumpToHash will run', {
      id: id,
      currentSectionId: getCurrentSectionId(),
      locationHash: location.hash,
      pageYOffset: window.pageYOffset || 0,
      ranges: getSectionRanges()
    });
  }

  jumpToHash();
}, true);

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('mousemove', onMouseMove, { passive: true });
window.addEventListener('resize', onResize);

})();

/* =========================================================
   DELIVERABLE PANEL
   ========================================================= */

(function () {
  function closePanel(button, panel) {
    if (!button || !panel) return;

    button.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');

    window.setTimeout(function () {
      if (button.getAttribute('aria-expanded') === 'false') {
        panel.hidden = true;
      }
    }, 260);
  }

  function openPanel(button, panel) {
    if (!button || !panel) return;

    button.setAttribute('aria-expanded', 'true');
    panel.hidden = false;

    requestAnimationFrame(function () {
      panel.classList.add('is-open');
    });
  }

  function closeAllDeliverablePanels(exceptButton) {
    document.querySelectorAll('.ka-deliverable').forEach((button) => {
      const panel = button.parentElement.querySelector('.ka-deliverable__panel');
      if (!panel) return;

      if (button !== exceptButton) {
        closePanel(button, panel);
      }
    });
  }

  document.addEventListener('click', function (event) {
    const button = event.target.closest('.ka-deliverable');

    if (button) {
      const panel = button.parentElement.querySelector('.ka-deliverable__panel');
      if (!panel) return;

      const isOpen = button.getAttribute('aria-expanded') === 'true';

      closeAllDeliverablePanels(button);

      if (isOpen) {
        closePanel(button, panel);
      } else {
        openPanel(button, panel);
      }

      return;
    }

    if (!event.target.closest('.ka-card__deliverable')) {
      closeAllDeliverablePanels(null);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeAllDeliverablePanels(null);
    }
  });
})();
