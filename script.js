(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desktopQuery = window.matchMedia('(min-width: 1180px)');

  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  function $$(selector, context) {
    return Array.prototype.slice.call((context || document).querySelectorAll(selector));
  }

  function hideLoader() {
    document.body.classList.remove('is-loading');
  }

  window.addEventListener('load', function () {
    window.setTimeout(hideLoader, reduceMotion ? 0 : 350);
  });
  window.setTimeout(hideLoader, 2400);

  var header = $('.site-header');
  var scrollBar = $('#scroll-bar');
  var toTop = $('#to-top');
  var mobileBar = $('.mobile-bar');
  var ticking = false;

  var navLinks = $$('.main-nav a');
  var hashLinks = navLinks.filter(function (link) {
    return (link.getAttribute('href') || '').charAt(0) === '#';
  });
  var navSections = hashLinks.map(function (link) {
    return document.getElementById(link.getAttribute('href').slice(1));
  }).filter(Boolean);

  function markCurrentPage() {
    var path = window.location.pathname.replace(/\\/g, '/');
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    navLinks.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^https?:/.test(href)) return;
      var clean = href.split('#')[0];
      if (clean === file || (file === '' && clean === 'index.html')) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function updateActiveNav(y) {
    if (!hashLinks.length || !navSections.length) return;

    var offset = (header ? header.offsetHeight : 0) + 90;
    var currentId = navSections[0].id;

    navSections.forEach(function (section) {
      if (section.offsetTop - offset <= y) currentId = section.id;
    });

    if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) {
      currentId = navSections[navSections.length - 1].id;
    }

    hashLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + currentId);
    });
  }

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var docH = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle('is-scrolled', y > 12);
    if (scrollBar) scrollBar.style.width = (docH > 0 ? Math.min(100, (y / docH) * 100) : 0) + '%';
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
    if (mobileBar) mobileBar.classList.toggle('is-visible', y > 520);

    updateActiveNav(y);
    updateReadingProgress();

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  markCurrentPage();
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  var menuToggle = $('#menu-toggle');
  var mobileMenu = $('#mobile-menu');

  function setMenu(open) {
    if (!menuToggle || !mobileMenu) return;

    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.classList.toggle('is-locked', open);
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function () {
      setMenu(!mobileMenu.classList.contains('is-open'));
    });

    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) setMenu(false);
    });

    document.addEventListener('click', function (e) {
      if (!mobileMenu.classList.contains('is-open')) return;
      if (mobileMenu.contains(e.target) || menuToggle.contains(e.target)) return;
      setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) setMenu(false);
    });

    var closeMenuOnDesktop = function () {
      if (desktopQuery.matches) setMenu(false);
    };

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', closeMenuOnDesktop);
    } else if (typeof desktopQuery.addListener === 'function') {
      desktopQuery.addListener(closeMenuOnDesktop);
    }
    window.addEventListener('resize', closeMenuOnDesktop, { passive: true });
  }

  var revealEls = $$('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  function formatCount(value, decimals, prefix, suffix) {
    var fixed = value.toFixed(decimals);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return prefix + parts.join(',') + suffix;
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;

    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';

    if (reduceMotion) {
      el.textContent = formatCount(target, decimals, prefix, suffix);
      return;
    }

    var duration = 1500;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatCount(target * eased, decimals, prefix, suffix);
      if (progress < 1) window.requestAnimationFrame(step);
    }

    el.textContent = formatCount(0, decimals, prefix, suffix);
    window.requestAnimationFrame(step);
  }

  var countEls = $$('[data-count]');

  if ('IntersectionObserver' in window && !reduceMotion) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    countEls.forEach(function (el) { countObserver.observe(el); });
  } else {
    countEls.forEach(animateCount);
  }

  var countdown = $('[data-countdown]');

  if (countdown) {
    var cdFields = {
      days: $('[data-cd-days]', countdown),
      hours: $('[data-cd-hours]', countdown),
      minutes: $('[data-cd-minutes]', countdown),
      seconds: $('[data-cd-seconds]', countdown)
    };
    var cdTitle = $('[data-cd-title]', countdown);
    var months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var moscowOffset = 3 * 60 * 60 * 1000;

    function plural(value, one, few, many) {
      var lastTwo = value % 100;
      if (lastTwo >= 11 && lastTwo <= 14) return many;
      var last = value % 10;
      if (last === 1) return one;
      if (last >= 2 && last <= 4) return few;
      return many;
    }

    function tickCountdown() {
      var now = Date.now();
      var moscow = new Date(now + moscowOffset);
      var month = moscow.getUTCMonth();
      var end = Date.UTC(moscow.getUTCFullYear(), month + 1, 1) - moscowOffset;
      var left = Math.max(0, Math.floor((end - now) / 1000));

      var values = {
        days: Math.floor(left / 86400),
        hours: Math.floor((left % 86400) / 3600),
        minutes: Math.floor((left % 3600) / 60),
        seconds: left % 60
      };

      if (cdTitle) cdTitle.textContent = 'До конца ' + months[month];

      Object.keys(values).forEach(function (key) {
        if (cdFields[key]) cdFields[key].textContent = String(values[key]).padStart(2, '0');
      });

      var labels = countdown.querySelectorAll('[data-cd-label]');
      if (labels.length === 4) {
        labels[0].textContent = plural(values.days, 'день', 'дня', 'дней');
        labels[1].textContent = plural(values.hours, 'час', 'часа', 'часов');
        labels[2].textContent = plural(values.minutes, 'минута', 'минуты', 'минут');
        labels[3].textContent = plural(values.seconds, 'секунда', 'секунды', 'секунд');
      }
    }

    tickCountdown();
    window.setInterval(tickCountdown, 1000);
  }

  function initParticles() {
    var canvas = $('.hero__canvas');
    if (!canvas || reduceMotion) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var colors = ['139,92,246', '34,211,238', '236,72,153', '110,231,183'];
    var particles = [];
    var width = 0;
    var height = 0;
    var animationId = 0;

    function sizeCanvas() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.min(56, Math.max(20, Math.floor((width * height) / 30000)));
      particles = Array.from({ length: count }, function () {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          r: Math.random() * 1.7 + 0.6,
          c: colors[Math.floor(Math.random() * colors.length)],
          a: Math.random() * 0.5 + 0.2
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.c + ',' + p.a + ')';
        ctx.fill();
      });

      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var a = particles[i];
          var b = particles[j];
          var dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = 'rgba(139,92,246,' + ((1 - dist / 130) * 0.16) + ')';
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      animationId = window.requestAnimationFrame(draw);
    }

    sizeCanvas();
    draw();

    var resizeTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(sizeCanvas, 150);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.cancelAnimationFrame(animationId);
      } else {
        animationId = window.requestAnimationFrame(draw);
      }
    });
  }

  initParticles();

  var hero = $('.hero');
  var heroVisual = $('.hero__visual');

  if (hero && heroVisual && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    var raf = 0;
    hero.addEventListener('pointermove', function (e) {
      var rect = hero.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(function () {
        heroVisual.style.transform = 'translate3d(' + (x * 14) + 'px,' + (y * 12) + 'px,0)';
      });
    });

    hero.addEventListener('pointerleave', function () {
      window.cancelAnimationFrame(raf);
      heroVisual.style.transform = '';
    });
  }

  $$('.offer, .buy-card, .article-card, .infra-card, .stat-card, .aside-card').forEach(function (card) {
    card.classList.add('spotlight');
    card.addEventListener('pointermove', function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
    });
  });

  var modal = $('#callback-modal');
  var modalForm = $('#callback-form');
  var lastFocused = null;

  function trapFocus(container, e) {
    if (e.key !== 'Tab' || !container) return;

    var focusables = $$(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
      'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });

    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openModal(format) {
    if (!modal) return;

    lastFocused = document.activeElement;

    var select = $('#cb-format');
    if (select && format) {
      var match = Array.prototype.filter.call(select.options, function (option) {
        return option.value === format;
      })[0];
      if (match) select.value = format;
    }

    if (modalForm) setStatus(modalForm, '', false);

    modal.hidden = false;
    void modal.offsetWidth;
    modal.classList.add('is-open');
    document.body.classList.add('is-locked');

    var focusTarget = select || $('#cb-phone');
    if (focusTarget) {
      window.requestAnimationFrame(function () { focusTarget.focus(); });
    }
  }

  function closeModal() {
    if (!modal || modal.hidden) return;

    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.classList.remove('is-locked');

    if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
      lastFocused.focus();
    }
  }

  $$('[data-modal-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openModal(btn.getAttribute('data-format'));
    });
  });

  if (modal) {
    $$('[data-modal-close]', modal).forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') trapFocus(modal, e);
    });
  }

  function setError(field, message) {
    var errorEl = field ? document.getElementById(field.id + '-error') : null;

    if (!field) return;

    if (message) {
      field.setAttribute('aria-invalid', 'true');
      if (errorEl) errorEl.textContent = message;
    } else {
      field.removeAttribute('aria-invalid');
      if (errorEl) errorEl.textContent = '';
    }
  }

  function clearErrors(form) {
    $$('[aria-invalid]', form).forEach(function (field) {
      setError(field, '');
    });
    $$('.field-error', form).forEach(function (el) {
      el.textContent = '';
    });
  }

  function setStatus(form, message, isError) {
    var status = $('.form-status', form);
    if (!status) return;

    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  function digitsOf(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function isValidPhone(value) {
    var d = digitsOf(value);
    if (d.length === 10) return true;
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) return true;
    return false;
  }

  function maskPhone(input) {
    var d = digitsOf(input.value);

    if (d[0] === '8') d = '7' + d.slice(1);
    if (d.length && d[0] !== '7') d = '7' + d;
    if (d.length > 11) d = d.slice(0, 11);

    var out = '';
    if (d.length > 0) out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 5) out += ') ' + d.slice(4, 7);
    if (d.length >= 8) out += '-' + d.slice(7, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);

    input.value = out;
  }

  $$('[data-phone]').forEach(function (input) {
    input.addEventListener('input', function () {
      maskPhone(input);
      setError(input, '');
    });

    input.addEventListener('blur', function () {
      if (digitsOf(input.value).length <= 1) input.value = '';
    });
  });

  $$('input[type="text"], input[type="tel"], input[type="checkbox"]').forEach(function (input) {
    if (input.name === 'company') return;

    input.addEventListener('input', function () {
      setError(input, '');
    });
    input.addEventListener('change', function () {
      setError(input, '');
    });
  });

  function validateForm(form) {
    var ok = true;
    var firstBad = null;

    var name = $('input[name="name"]', form);
    var phone = $('[data-phone]', form);
    var consent = $('[data-consent]', form);

    if (name) {
      var nameValue = name.value.trim();
      if (nameValue.length === 1) {
        setError(name, 'Укажите имя полностью');
        ok = false;
        firstBad = firstBad || name;
      } else if (nameValue.length > 80) {
        setError(name, 'Слишком длинное имя — до 80 символов');
        ok = false;
        firstBad = firstBad || name;
      } else {
        setError(name, '');
      }
    }

    if (phone) {
      if (!phone.value.trim()) {
        setError(phone, 'Укажите номер телефона');
        ok = false;
        firstBad = firstBad || phone;
      } else if (!isValidPhone(phone.value)) {
        setError(phone, 'Введите номер полностью: 10–11 цифр');
        ok = false;
        firstBad = firstBad || phone;
      } else {
        setError(phone, '');
      }
    }

    if (consent && !consent.checked) {
      setError(consent, 'Отметьте согласие на обработку персональных данных');
      ok = false;
      firstBad = firstBad || consent;
    } else if (consent) {
      setError(consent, '');
    }

    if (firstBad) firstBad.focus();
    return ok;
  }

  function finishSubmit(form, button, originalLabel) {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
    form.removeAttribute('aria-busy');
  }

  $$('form.form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (form.dataset.sending === '1') return;

      if (!validateForm(form)) {
        setStatus(form, '', false);
        return;
      }

      var button = $('[type="submit"]', form);
      var originalLabel = button ? button.textContent : '';
      var payload = {};

      new FormData(form).forEach(function (value, key) {
        payload[key] = value;
      });

      payload.page = window.location.href;
      payload.sentAt = new Date().toISOString();

      form.dataset.sending = '1';
      form.setAttribute('aria-busy', 'true');
      if (button) {
        button.disabled = true;
        button.textContent = 'Отправляем…';
      }
      setStatus(form, '', false);

      function succeed(data) {
        form.reset();
        clearErrors(form);
        setStatus(
          form,
          (data && data.message) || 'Спасибо! Заявка отправлена. Специалист свяжется с вами в течение 15 минут.',
          false
        );
        finishSubmit(form, button, originalLabel);
        form.dataset.sending = '0';
      }

      function fail(message) {
        setStatus(
          form,
          message || 'Не удалось отправить заявку. Позвоните нам: 8 (800) 511-90-05.',
          true
        );
        finishSubmit(form, button, originalLabel);
        form.dataset.sending = '0';
      }

      fetch('send.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'fetch'
        },
        body: JSON.stringify(payload)
      }).then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (response.ok && data && data.ok) {
            succeed(data);
          } else {
            fail(data && data.error);
          }
        });
      }).catch(function () {
        fail('Не удалось отправить заявку. Проверьте соединение или позвоните нам: 8 (800) 511-90-05.');
      });
    });
  });

  $$('[data-video-play]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var frame = btn.closest('[data-video-src]');
      if (!frame) return;

      var src = frame.getAttribute('data-video-src');
      if (!src) return;

      var video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', 'Видеопрезентация «Сантерра»');

      var poster = frame.getAttribute('data-video-poster');
      if (poster) video.poster = poster;

      frame.innerHTML = '';
      frame.appendChild(video);

      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {});
      }
    });
  });

  $$('[data-map-load]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var frame = btn.closest('[data-map-query]');
      if (!frame) return;

      var query = frame.getAttribute('data-map-query');
      if (!query) return;

      var iframe = document.createElement('iframe');
      iframe.src = 'https://yandex.ru/map-widget/v1/?text=' + encodeURIComponent(query) + '&z=16';
      iframe.title = 'Карта: расположение «Сантерра», ул. Новая, д. 22Б';
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;

      frame.innerHTML = '';
      frame.appendChild(iframe);
    });
  });

  var lightbox = $('#lightbox');
  var lightboxImg = $('#lightbox-img');
  var lightboxCaption = $('#lightbox-caption');
  var galleryItems = $$('[data-lightbox]');
  var currentIndex = 0;
  var lightboxLastFocused = null;

  function showSlide(index) {
    if (!galleryItems.length || !lightboxImg) return;

    currentIndex = (index + galleryItems.length) % galleryItems.length;

    var item = galleryItems[currentIndex];
    var caption = item.getAttribute('data-caption') || '';

    lightboxImg.src = item.getAttribute('data-lightbox');
    lightboxImg.alt = caption;
    if (lightboxCaption) {
      lightboxCaption.textContent = (currentIndex + 1) + ' / ' + galleryItems.length +
        (caption ? ' — ' + caption : '');
    }
  }

  function openLightbox(index) {
    if (!lightbox) return;

    lightboxLastFocused = document.activeElement;
    showSlide(index);
    lightbox.hidden = false;
    void lightbox.offsetWidth;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Просмотр фотографий');
    document.body.classList.add('is-locked');

    var closeBtn = $('[data-lightbox-close]', lightbox);
    if (closeBtn) window.requestAnimationFrame(function () { closeBtn.focus(); });
  }

  function closeLightbox() {
    if (!lightbox) return;

    lightbox.classList.remove('is-open');
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');

    if (lightboxLastFocused && typeof lightboxLastFocused.focus === 'function' && document.contains(lightboxLastFocused)) {
      lightboxLastFocused.focus();
    }
  }

  galleryItems.forEach(function (item, index) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      openLightbox(index);
    });
  });

  if (lightbox) {
    $$('[data-lightbox-close]', lightbox).forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });

    $$('[data-lightbox-prev]', lightbox).forEach(function (el) {
      el.addEventListener('click', function () { showSlide(currentIndex - 1); });
    });

    $$('[data-lightbox-next]', lightbox).forEach(function (el) {
      el.addEventListener('click', function () { showSlide(currentIndex + 1); });
    });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('is-open')) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showSlide(currentIndex - 1);
      if (e.key === 'ArrowRight') showSlide(currentIndex + 1);
      if (e.key === 'Tab') trapFocus(lightbox, e);
    });
  }

  $$('.faq-item').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;

      $$('.faq-item[open]').forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  function updateReadingProgress() {
    var bar = $('[data-reading-progress]');
    var body = $('[data-article-body]');
    if (!bar || !body) return;

    var rect = body.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    var passed = Math.min(Math.max(-rect.top + 140, 0), Math.max(total, 1));
    bar.style.width = Math.min((passed / Math.max(total, 1)) * 100, 100) + '%';
  }

  updateReadingProgress();

  function toast(message) {
    var el = $('.copy-note');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-error');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () {
      el.textContent = '';
    }, 3000);
  }

  $$('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var type = btn.getAttribute('data-share');
      var url = encodeURIComponent(window.location.href);
      var title = encodeURIComponent(document.title);
      var links = {
        vk: 'https://vk.com/share.php?url=' + url + '&title=' + title,
        tg: 'https://t.me/share/url?url=' + url + '&text=' + title
      };

      if (type === 'copy') {
        var value = window.location.href;
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(value).then(function () {
            toast('Ссылка скопирована');
          }).catch(function () {
            toast(value);
          });
        } else {
          toast(value);
        }
        return;
      }

      if (links[type]) window.open(links[type], '_blank', 'noopener,noreferrer,width=640,height=540');
    });
  });

  var filterGrid = $('[data-filter-grid]');

  if (filterGrid) {
    var cards = $$('[data-cat]', filterGrid);
    var chips = $$('[data-filter]');
    var empty = $('[data-empty]');

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var value = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');

        var visible = 0;
        cards.forEach(function (card) {
          var show = value === 'all' || card.getAttribute('data-cat') === value;
          card.hidden = !show;
          if (show) visible++;
        });

        if (empty) empty.hidden = visible > 0;
      });
    });
  }

  var copyBtn = $('[data-copy-rss]');
  var copyNote = $('[data-copy-note]');
  var copyTimer = null;

  function showCopyNote(message, isError) {
    if (!copyNote) return;

    copyNote.textContent = message;
    copyNote.classList.toggle('is-error', !!isError);

    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(function () {
      copyNote.textContent = '';
      copyNote.classList.remove('is-error');
    }, 3500);
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-9999px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();

      try {
        var copied = document.execCommand('copy');
        document.body.removeChild(area);
        if (copied) resolve();
        else reject(new Error('copy failed'));
      } catch (err) {
        document.body.removeChild(area);
        reject(err);
      }
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return fallbackCopy(text);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var urlEl = $('.rss-card__url code');
      var url = urlEl && urlEl.textContent.trim()
        ? urlEl.textContent.trim()
        : 'https://apartamenty.poprostomy.ru/rss.xml';

      copyText(url).then(function () {
        showCopyNote('Ссылка скопирована в буфер обмена', false);
      }).catch(function () {
        showCopyNote('Не удалось скопировать. Скопируйте адрес вручную.', true);
      });
    });
  }

  $$('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  if (!reduceMotion) {
    var main = $('main');
    if (main) main.classList.add('page-enter');
  }

  window.__santerraReady = true;
})();
