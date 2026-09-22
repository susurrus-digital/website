(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SCROLL_CUE_DELAY_MS = 2000;

  // Reveals the "scroll for more" cue and the pronunciation tagline two
  // seconds after the logo finishes appearing. Watches for the .visible
  // class the logo gains once its own reveal sequence completes, rather
  // than duplicating that sequence's timing here. Runs independently of the
  // particle animations below so it still works under
  // prefers-reduced-motion, where the logo is shown immediately via CSS
  // instead of through the JS sequence.
  function initScrollCue() {
    var introHints = document.querySelectorAll(".intro-hint");
    var logo = document.querySelector(".logo");
    var bioPhoto = document.querySelector(".bio-photo");
    var bioText = document.querySelector(".bio-text");
    var contactCue = document.querySelector(".contact-cue");
    if (!introHints.length || !logo) return;

    // Once the hints have had their chance to appear, hide them as soon as
    // a quarter of either the bio photo or the bio text has scrolled into
    // view (whichever comes first — they stack on narrow/mobile screens),
    // and restore them if the user scrolls back above that point. The
    // contact cue does the inverse, showing only while the bio is in view.
    // Driven by
    // IntersectionObserver rather than a scroll-position threshold so it
    // tracks the actual content instead of viewport height, which is
    // unreliable on mobile browsers as their chrome shows/hides.
    function watchBioVisibility() {
      var targets = [bioPhoto, bioText].filter(Boolean);
      if (!targets.length) return;

      var visible = Object.create(null);
      function update() {
        var anyVisible = targets.some(function (el) {
          return visible[el === bioPhoto ? "photo" : "text"];
        });
        introHints.forEach(function (hint) {
          hint.classList.toggle("stage-hidden", anyVisible);
        });
        if (contactCue) contactCue.classList.toggle("visible", anyVisible);
      }

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visible[entry.target === bioPhoto ? "photo" : "text"] = entry.isIntersecting;
          });
          update();
        },
        { threshold: 0.25 }
      );
      targets.forEach(function (el) {
        observer.observe(el);
      });
    }

    function reveal() {
      setTimeout(function () {
        introHints.forEach(function (hint) {
          hint.classList.add("visible");
        });
      }, SCROLL_CUE_DELAY_MS);
    }

    watchBioVisibility();

    if (reducedMotion || logo.classList.contains("visible")) {
      reveal();
      return;
    }

    var observer = new MutationObserver(function () {
      if (logo.classList.contains("visible")) {
        observer.disconnect();
        reveal();
      }
    });
    observer.observe(logo, { attributes: true, attributeFilter: ["class"] });
  }

  initScrollCue();

  if (reducedMotion) {
    return;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // Parses a resolved CSS <time> ("1.5s" / "300ms") into milliseconds.
  function cssTimeToMs(value) {
    value = (value || "").trim();
    if (value.endsWith("ms")) return parseFloat(value);
    if (value.endsWith("s")) return parseFloat(value) * 1000;
    return parseFloat(value) || 0;
  }

  // Each quote has two comma-separated animations: quote-in, then
  // quote-out. Reading the *second* resolved delay off the element itself
  // (rather than duplicating numbers here) tells us exactly when that
  // quote's own fade-out/dissolve begins, however the CSS timeline is tuned.
  function fadeOutDelayMs(el) {
    var parts = getComputedStyle(el).animationDelay.split(",");
    return cssTimeToMs(parts[parts.length - 1]);
  }

  // Runs `cb` once the image has pixels to read. Prefers the synchronous
  // `complete` check over img.decode(), which can stall indefinitely while
  // the tab is backgrounded in some browsers. Falls back to the load event
  // with a safety timeout so this can never hang the sequence.
  function whenImageReady(img, cb) {
    if (img.complete && img.naturalWidth > 0) {
      cb();
      return;
    }
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      cb();
    };
    img.addEventListener("load", finish, { once: true });
    setTimeout(finish, 2000);
  }

  function setVars(el, props) {
    Object.keys(props).forEach(function (key) {
      el.style.setProperty(key, props[key]);
    });
  }

  // Subtle per-particle brightness/hue jitter (consumed by a CSS `filter`)
  // so a field of identical shapes doesn't read as mechanically-stamped
  // copies of one another.
  function tintVars() {
    return {
      "--tint-b": rand(0.88, 1.12).toFixed(2),
      "--tint-h": rand(-10, 10).toFixed(1) + "deg",
    };
  }

  // ---------------------------------------------------------------------
  // Quote 1 -> wind-blown leaves
  // ---------------------------------------------------------------------

  var LEAF_COUNT = 22;

  // A few different silhouettes (each with a matching vein) so 22 leaves
  // don't read as one shape copy-pasted at different sizes.
  var LEAF_VARIANTS = [
    { shape: "M0 -28 C16 -14 18 14 0 30 C-18 14 -16 -14 0 -28 Z", vein: "M0 -22 L0 24" },
    { shape: "M0 -26 C20 -18 14 18 0 29 C-10 12 -16 -10 0 -26 Z", vein: "M0 -20 Q6 4 0 23" },
    { shape: "M0 -30 C10 -20 20 6 0 28 C-20 6 -10 -20 0 -30 Z", vein: "M0 -24 Q-4 0 0 22" },
  ];

  function createLeaf(spreadX, spreadY, centerX, viewportWidth, edgeMargin) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "-32 -32 64 64");
    svg.classList.add("leaf");

    var variant = LEAF_VARIANTS[Math.floor(Math.random() * LEAF_VARIANTS.length)];

    var shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", variant.shape);
    shape.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(shape);

    var vein = document.createElementNS(SVG_NS, "path");
    vein.setAttribute("d", variant.vein);
    vein.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(vein);

    var x0 = rand(-spreadX, spreadX);
    var y0 = rand(-spreadY, spreadY);

    // Cap rightward travel to the space actually available to the edge from
    // THIS leaf's own starting point, so it's always safely faded out well
    // before it would reach the edge, however narrow the viewport is. The
    // animation's opacity hits 0 at the 85% keyframe (not 100%), so capping
    // the full travel to 75% of the available room keeps a solid margin.
    var available = Math.max(viewportWidth - (centerX + x0) - edgeMargin, 24);
    var dxMax = available * 0.75;
    var dxMin = Math.min(60, dxMax * 0.5);
    var dx = rand(dxMin, dxMax);

    var rot0 = rand(-15, 15);
    setVars(
      svg,
      Object.assign(
        {
          "--size": rand(16, 32).toFixed(1) + "px",
          "--x0": x0.toFixed(1) + "px",
          "--y0": y0.toFixed(1) + "px",
          "--dx": dx.toFixed(1) + "px",
          "--dy": rand(-30, 30).toFixed(1) + "px",
          "--rot0": rot0.toFixed(1) + "deg",
          "--rot1": (rot0 + rand(70, 180)).toFixed(1) + "deg",
          "--duration": rand(1.6, 2.3).toFixed(2) + "s",
          "--delay": rand(0, 0.4).toFixed(2) + "s",
        },
        tintVars()
      )
    );

    return svg;
  }

  // Scatters leaves within the bounds of the quote text itself (measured
  // live) rather than a fixed pixel range, so the spread scales correctly
  // on narrow screens instead of starting some leaves off-canvas.
  function populateLeaves(container) {
    var target = document.querySelector("." + container.dataset.target);
    var rect = target ? target.getBoundingClientRect() : null;
    var spreadX = rect ? rect.width * 0.4 : 140;
    var spreadY = rect ? rect.height * 0.4 : 40;
    var viewportWidth = window.innerWidth;
    var centerX = viewportWidth / 2;
    var edgeMargin = 32;
    for (var i = 0; i < LEAF_COUNT; i++) {
      container.appendChild(createLeaf(spreadX, spreadY, centerX, viewportWidth, edgeMargin));
    }
  }

  // ---------------------------------------------------------------------
  // Quote 2 -> toppling book spines -> dots rising into the logo's shape
  // ---------------------------------------------------------------------

  var BOOK_COUNT = 18;
  var DOT_COUNT = 170;
  var DOT_PHASE_OFFSET_MS = 700; // dots start rising while books are still falling
  var DOT_SETTLE_HOLD_MS = 400; // brief pause once dots have formed the logo

  function createBook(spreadX, baseY) {
    var book = document.createElement("div");
    book.className = "book";

    var fallDir = Math.random() < 0.5 ? -1 : 1;
    setVars(
      book,
      Object.assign(
        {
          "--w": rand(12, 20).toFixed(1) + "px",
          "--h": rand(46, 84).toFixed(1) + "px",
          "--x0": rand(-spreadX, spreadX).toFixed(1) + "px",
          "--base-y": baseY.toFixed(1) + "px",
          "--fall-rot": (fallDir * rand(78, 98)).toFixed(1) + "deg",
          "--duration": rand(0.9, 1.3).toFixed(2) + "s",
          "--delay": rand(0, 0.55).toFixed(2) + "s",
        },
        tintVars()
      )
    );

    return book;
  }

  function populateBooks(container, textRect) {
    var spreadX = textRect ? textRect.width * 0.38 : 120;
    var baseY = (textRect ? textRect.height * 0.5 : 30) + 24;
    for (var i = 0; i < BOOK_COUNT; i++) {
      container.appendChild(createBook(spreadX, baseY));
    }
    return { spreadX: spreadX, baseY: baseY };
  }

  // Draws the (already-loaded) logo onto an offscreen canvas and returns a
  // random sample of its opaque pixel coordinates, normalized to -0.5..0.5
  // relative to the image's own center. This makes the dots gather into the
  // logo's *actual* silhouette rather than an approximation of it.
  function sampleLogoPoints(imgEl, count) {
    var naturalW = imgEl.naturalWidth || 1127;
    var naturalH = imgEl.naturalHeight || 722;
    var sampleW = 200;
    var sampleH = Math.round(sampleW * (naturalH / naturalW));

    var canvas = document.createElement("canvas");
    canvas.width = sampleW;
    canvas.height = sampleH;
    var ctx = canvas.getContext("2d");

    try {
      ctx.drawImage(imgEl, 0, 0, sampleW, sampleH);
      var data = ctx.getImageData(0, 0, sampleW, sampleH).data;
    } catch (err) {
      return [];
    }

    var candidates = [];
    for (var y = 0; y < sampleH; y++) {
      for (var x = 0; x < sampleW; x++) {
        var alpha = data[(y * sampleW + x) * 4 + 3];
        if (alpha > 140) {
          candidates.push({
            nx: (x - sampleW / 2) / sampleW,
            ny: (y - sampleH / 2) / sampleH,
          });
        }
      }
    }

    // Some privacy-hardened browsers (e.g. Brave, Firefox strict mode) inject
    // noise into canvas pixel reads for fingerprint resistance, which can
    // silently corrupt this into a garbled scatter instead of throwing. A
    // real logo silhouette with margin around it always lands within a
    // plausible pixel-count band; outside that band, treat the read as
    // unreliable and fall back to skipping the dot effect entirely rather
    // than showing a broken/garbled formation.
    var totalPixels = sampleW * sampleH;
    var tooFew = candidates.length < 300;
    var tooMany = candidates.length > totalPixels * 0.5;
    if (tooFew || tooMany) {
      return [];
    }

    // Shuffle (Fisher-Yates) then take the requested count.
    for (var i = candidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    return candidates.slice(0, count);
  }

  function createDot(point, logoRect, startSpreadX, baseY) {
    var dot = document.createElement("div");
    dot.className = "dot";

    var tx = point.nx * logoRect.width;
    var ty = point.ny * logoRect.height;

    setVars(
      dot,
      Object.assign(
        {
          "--size": rand(2.5, 5).toFixed(1) + "px",
          "--x0": rand(-startSpreadX, startSpreadX).toFixed(1) + "px",
          "--y0": (baseY + rand(-6, 10)).toFixed(1) + "px",
          "--tx": tx.toFixed(1) + "px",
          "--ty": ty.toFixed(1) + "px",
          "--duration": rand(1.1, 1.7).toFixed(2) + "s",
          "--delay": rand(0, 0.9).toFixed(2) + "s",
        },
        tintVars()
      )
    );

    return dot;
  }

  function populateDots(container, points, logoRect, startSpreadX, baseY) {
    var maxDelayMs = 0;
    var maxDurationMs = 0;
    points.forEach(function (point) {
      var dot = createDot(point, logoRect, startSpreadX, baseY);
      container.appendChild(dot);
      maxDelayMs = Math.max(maxDelayMs, parseFloat(dot.style.getPropertyValue("--delay")) * 1000);
      maxDurationMs = Math.max(
        maxDurationMs,
        parseFloat(dot.style.getPropertyValue("--duration")) * 1000
      );
    });
    return maxDelayMs + maxDurationMs;
  }

  function runQuote2Sequence(bookBurst, dotField, logo) {
    var quoteDetail = document.querySelector(".quote-detail");
    if (!quoteDetail || !bookBurst || !dotField || !logo) return;

    var triggerMs = fadeOutDelayMs(quoteDetail);

    setTimeout(function () {
      var textRect = quoteDetail.getBoundingClientRect();
      var bookLayout = populateBooks(bookBurst, textRect);
      bookBurst.classList.add("burst");

      setTimeout(function () {
        // img.decode() can stall indefinitely while the tab is backgrounded
        // in some browsers (it's tied to the next successful paint), and by
        // this point in the timeline a user may well have switched tabs. The
        // logo is requested at page load and this fires many seconds later,
        // so img.complete is already reliable here without waiting on decode.
        whenImageReady(logo, function () {
          var logoRect = logo.getBoundingClientRect();
          var points = sampleLogoPoints(logo, DOT_COUNT);
          var dotsTotalMs = populateDots(
            dotField,
            points,
            logoRect,
            bookLayout.spreadX,
            bookLayout.baseY
          );
          dotField.classList.add("rise");

          setTimeout(function () {
            dotField.classList.add("settle");
            logo.classList.add("visible");
          }, dotsTotalMs + DOT_SETTLE_HOLD_MS);
        });
      }, DOT_PHASE_OFFSET_MS);
    }, triggerMs);
  }

  // ---------------------------------------------------------------------

  var introLeafBurst = document.querySelector('[data-target="quote-intro"]');
  var quoteIntro = document.querySelector(".quote-intro");
  if (introLeafBurst && quoteIntro) {
    populateLeaves(introLeafBurst);
    setTimeout(function () {
      introLeafBurst.classList.add("burst");
    }, fadeOutDelayMs(quoteIntro));
  }

  var bookBurst = document.querySelector(".book-burst");
  var dotField = document.querySelector(".dot-field");
  var logo = document.querySelector(".logo");
  runQuote2Sequence(bookBurst, dotField, logo);
})();
