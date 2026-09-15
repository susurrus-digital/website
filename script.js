(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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

  // ---------------------------------------------------------------------
  // Quote 1 -> wind-blown leaves
  // ---------------------------------------------------------------------

  var LEAF_COUNT = 22;
  var LEAF_PATH = "M0 -28 C16 -14 18 14 0 30 C-18 14 -16 -14 0 -28 Z";
  var LEAF_VEIN_PATH = "M0 -22 L0 24";

  function createLeaf(spreadX, spreadY, centerX, viewportWidth, edgeMargin) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "-32 -32 64 64");
    svg.classList.add("leaf");

    var shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", LEAF_PATH);
    shape.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(shape);

    var vein = document.createElementNS(SVG_NS, "path");
    vein.setAttribute("d", LEAF_VEIN_PATH);
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
    setVars(svg, {
      "--size": rand(16, 32).toFixed(1) + "px",
      "--x0": x0.toFixed(1) + "px",
      "--y0": y0.toFixed(1) + "px",
      "--dx": dx.toFixed(1) + "px",
      "--dy": rand(-30, 30).toFixed(1) + "px",
      "--rot0": rot0.toFixed(1) + "deg",
      "--rot1": (rot0 + rand(70, 180)).toFixed(1) + "deg",
      "--duration": rand(1.6, 2.3).toFixed(2) + "s",
      "--delay": rand(0, 0.4).toFixed(2) + "s",
    });

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

  var BOOK_COUNT = 9;
  var DOT_COUNT = 170;
  var DOT_PHASE_OFFSET_MS = 700; // dots start rising while books are still falling
  var DOT_SETTLE_HOLD_MS = 400; // brief pause once dots have formed the logo

  function createBook(spreadX, baseY) {
    var book = document.createElement("div");
    book.className = "book";

    var fallDir = Math.random() < 0.5 ? -1 : 1;
    setVars(book, {
      "--w": rand(12, 20).toFixed(1) + "px",
      "--h": rand(46, 84).toFixed(1) + "px",
      "--x0": rand(-spreadX, spreadX).toFixed(1) + "px",
      "--base-y": baseY.toFixed(1) + "px",
      "--fall-rot": (fallDir * rand(78, 98)).toFixed(1) + "deg",
      "--duration": rand(0.9, 1.3).toFixed(2) + "s",
      "--delay": rand(0, 0.55).toFixed(2) + "s",
    });

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

    setVars(dot, {
      "--size": rand(2.5, 5).toFixed(1) + "px",
      "--x0": rand(-startSpreadX, startSpreadX).toFixed(1) + "px",
      "--y0": (baseY + rand(-6, 10)).toFixed(1) + "px",
      "--tx": tx.toFixed(1) + "px",
      "--ty": ty.toFixed(1) + "px",
      "--duration": rand(1.1, 1.7).toFixed(2) + "s",
      "--delay": rand(0, 0.9).toFixed(2) + "s",
    });

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
