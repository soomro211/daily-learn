/* ==========================================================================
   daily-learn — app (M1)

   Live in this milestone:  theme choice and its persistence, hash routing,
   the deterministic daily pick, marking and starring within a session.
   Deliberately absent:     persistence of marks (M2), filters and search (M4),
                            shuffle logic and motion (M5), calendar (M3).

   Classic script, no modules: the app has to open straight from the
   filesystem, where module loading and fetch() are both blocked.
   ========================================================================== */

(function () {
  "use strict";

  var CATEGORIES = window.DL_CATEGORIES;
  var TOPICS = window.DL_TOPICS;
  var ROOT = document.documentElement;

  var CATEGORY_BY_ID = {};
  CATEGORIES.forEach(function (c) { CATEGORY_BY_ID[c.id] = c; });

  var TOPIC_BY_ID = {};
  TOPICS.forEach(function (t) { TOPIC_BY_ID[t.id] = t; });

  /* -------------------------------------------------------------- state ---
     Session state only. `learnt` and `starred` are Sets of topic ids; M2 moves
     them into localStorage behind these two accessors and nothing else changes.
     TODO(M2): persist through localStorage, same keys, same shape. */
  var learnt = new Set();
  var starred = new Set();

  var SCREENS = ["today", "library", "topic", "shuffle"];

  /* ------------------------------------------------------------ helpers --- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function svg(name, cls) {
    return '<svg class="' + (cls || "") + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }

  function categoryOf(topic) {
    return CATEGORY_BY_ID[topic.category] || { id: topic.category, label: topic.category };
  }

  function domainOf(url) {
    var match = /^https?:\/\/([^/]+)/.exec(url);
    return match ? match[1].replace(/^www\./, "") : "";
  }

  /* Local calendar fields, never UTC: a daily pick that shifts at midnight in
     another timezone would feel like a bug. */
  function dayNumber(date) {
    return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 864e5);
  }

  /* Deterministic for the day, spread across the set. Same date, same topic,
     for everyone, on every device — no randomness survives a reload. */
  function indexForDay(date, length) {
    var h = (dayNumber(date) * 2654435761) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) % length;
  }

  function topicOfTheDay(date) {
    return TOPICS[indexForDay(date || new Date(), TOPICS.length)];
  }

  function longDate(date) {
    return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }

  function shortDate(date) {
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  /* --------------------------------------------------------------- theme --- */
  var THEME_COLORS = { dark: "#0f0e0c", light: "#f4f0e8" };

  function applyTheme(theme) {
    ROOT.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.dark);

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.setAttribute("aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
  }

  function initTheme() {
    applyTheme(ROOT.getAttribute("data-theme") || "dark");

    document.getElementById("theme-toggle").addEventListener("click", function () {
      var next = ROOT.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("dl.theme", next); } catch (e) { /* private mode */ }
    });

    /* Follow the OS only until the visitor makes a choice of their own. */
    if (window.matchMedia) {
      var query = window.matchMedia("(prefers-color-scheme: light)");
      var onChange = function (event) {
        var stored = null;
        try { stored = localStorage.getItem("dl.theme"); } catch (e) { return; }
        if (!stored) applyTheme(event.matches ? "light" : "dark");
      };
      if (query.addEventListener) query.addEventListener("change", onChange);
      else if (query.addListener) query.addListener(onChange);
    }
  }

  /* --------------------------------------------------------- topic markup --- */
  /* One renderer for both Today and a topic opened from the index. The reading
     view is the shape every topic will take, so it is written to the fields in
     data/topics.js and to nothing else. */
  function topicMarkup(topic, options) {
    var opts = options || {};
    var cat = categoryOf(topic);
    var isLearnt = learnt.has(topic.id);
    var isStarred = starred.has(topic.id);

    var eyebrow = opts.eyebrow ||
      '<span class="eyebrow-mark eyebrow-cat"></span>' + esc(cat.label);

    var points = (topic.points || []).map(function (point) {
      return "<li>" + esc(point) + "</li>";
    }).join("");

    var related = (topic.related || [])
      .filter(function (id) { return TOPIC_BY_ID[id]; })
      .map(function (id) {
        var target = TOPIC_BY_ID[id];
        return '<a class="chip" href="#/topic/' + esc(target.id) + '" data-cat="' + esc(target.category) + '">' +
                 '<span class="chip-dot"></span>' + esc(target.title) +
               "</a>";
      }).join("");

    return '' +
      '<article class="topic" data-cat="' + esc(topic.category) + '">' +
        '<header class="topic-head">' +
          '<p class="eyebrow">' + eyebrow + "</p>" +
          "<h1 class=\"topic-title\" id=\"" + (opts.titleId || "topic-h") + '">' + esc(topic.title) + "</h1>" +
          '<div class="topic-kicker"><span class="chip"><span class="chip-dot"></span>' +
            esc(cat.label) + "</span><hr class=\"hairline\"></div>" +
        "</header>" +

        '<p class="standfirst">' + esc(topic.summary) + "</p>" +

        '<span class="rule"></span>' +

        '<div class="blocks">' +
          '<section><h2 class="block-label">Three things to hold on to</h2>' +
            '<ul class="points">' + points + "</ul></section>" +
          '<section class="caveat"><h2 class="block-label">Where it gets misstated</h2>' +
            "<p>" + esc(topic.caveat) + "</p></section>" +
        "</div>" +

        '<section class="source-row">' +
          '<h2 class="block-label">Read it properly</h2>' +
          '<a class="source" href="' + esc(topic.source.url) + '" target="_blank" rel="noopener noreferrer">' +
            "<span>" +
              '<span class="source-action">' + esc(topic.source.label) + "</span>" +
              '<span class="source-site">' + esc(domainOf(topic.source.url)) + "</span>" +
            "</span>" +
            svg("i-arrow-out", "source-arrow") +
          "</a>" +
        "</section>" +

        '<div class="topic-actions">' +
          '<button class="btn btn-primary" type="button" data-act="learnt" data-id="' + esc(topic.id) + '"' +
            ' aria-pressed="' + (isLearnt ? "true" : "false") + '">' +
            (isLearnt ? svg("i-check") : "") +
            "<span>" + (isLearnt ? "Learnt" : "Mark as learnt") + "</span>" +
          "</button>" +
          '<button class="btn btn-icon" type="button" data-act="star" data-id="' + esc(topic.id) + '"' +
            ' aria-pressed="' + (isStarred ? "true" : "false") + '"' +
            ' aria-label="' + (isStarred ? "Remove from starred" : "Add to starred") + '">' +
            svg("i-star") +
          "</button>" +
        "</div>" +

        (related
          ? '<section class="related"><h2 class="block-label">Related topics</h2>' +
            '<div class="related-list">' + related + "</div></section>"
          : "") +
      "</article>";
  }

  /* -------------------------------------------------------------- screens --- */
  function weekStripMarkup(today) {
    /* Monday-first strip. M1 draws only the shape; the dots that light up come
       with the calendar in M3. */
    var monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    var dots = "";
    for (var i = 0; i < 7; i += 1) {
      var day = new Date(monday);
      day.setDate(monday.getDate() + i);
      dots += "<i" + (dayNumber(day) === dayNumber(today) ? ' data-today="true"' : "") + "></i>";
    }
    return dots;
  }

  function renderToday() {
    var now = new Date();
    var topic = topicOfTheDay(now);

    document.getElementById("screen-today").innerHTML =
      '<div class="today">' +
        '<section class="today-strip">' +
          '<div class="strip-stat"><span class="strip-value">' +
            learnt.size + "<small>/" + TOPICS.length + "</small></span>" +
            '<span class="strip-label">Learnt</span></div>' +
          '<div class="strip-stat"><span class="strip-value">' + starred.size + "</span>" +
            '<span class="strip-label">Starred</span></div>' +
          '<div class="strip-stat"><span class="strip-value">' +
            '<span class="week">' + weekStripMarkup(now) + "</span></span>" +
            '<span class="strip-label">This week</span></div>' +
        "</section>" +
        topicMarkup(topic, {
          titleId: "today-h",
          eyebrow: '<span class="eyebrow-mark"></span>' + esc(longDate(now)) + " · today's topic"
        }) +
      "</div>";
  }

  function cardMarkup(topic) {
    var cat = categoryOf(topic);
    var isLearnt = learnt.has(topic.id);
    var isStarred = starred.has(topic.id);

    var marks =
      '<span class="marks">' +
        '<span class="mark-learnt"' + (isLearnt ? "" : " hidden") + ' title="Learnt">' + svg("i-check") + "</span>" +
        '<span class="mark-star"' + (isStarred ? "" : " hidden") + ' title="Starred">' + svg("i-star") + "</span>" +
      "</span>";

    return '<a class="card" href="#/topic/' + esc(topic.id) + '" data-cat="' + esc(topic.category) + '"' +
             ' data-learnt="' + (isLearnt ? "true" : "false") + '">' +
             '<span class="chip"><span class="chip-dot"></span>' + esc(cat.label) + "</span>" +
             '<h3 class="card-title">' + esc(topic.title) + "</h3>" +
             '<p class="card-excerpt">' + esc(topic.summary) + "</p>" +
             '<span class="card-foot">' +
               '<span class="source-site">' + esc(domainOf(topic.source.url)) + "</span>" +
               marks + "</span>" +
           "</a>";
  }

  function renderLibrary() {
    var pct = TOPICS.length ? Math.round((learnt.size / TOPICS.length) * 100) : 0;

    var filters = CATEGORIES.map(function (cat, i) {
      return '<button class="chip" type="button" data-cat="' + esc(cat.id) + '" aria-disabled="true"' +
               (i === 0 ? ' aria-pressed="true"' : "") + '><span class="chip-dot"></span>' +
               esc(cat.label) + "</button>";
    }).join("");

    var tabs = ["All", "Unread", "Learnt", "Starred"].map(function (label, i) {
      return '<button class="tab-btn" type="button" aria-disabled="true" aria-selected="' +
               (i === 0 ? "true" : "false") + '">' + label + "</button>";
    }).join("");

    document.getElementById("screen-library").innerHTML =
      '<div class="library">' +
        '<header><p class="eyebrow" id="library-h"><span class="eyebrow-mark"></span>The index</p></header>' +

        '<div class="meter">' +
          '<div class="meter-head"><span>Learnt so far</span>' +
            '<span class="meter-count">' + learnt.size + " of " + TOPICS.length + "</span></div>" +
          '<div class="meter-track"><span class="meter-fill" style="width:' + pct + '%"></span></div>' +
        "</div>" +

        '<label class="field"><span>' + svg("i-search") + "</span>" +
          '<input type="search" aria-disabled="true" placeholder="Search titles, summaries and fields" aria-label="Search topics">' +
        "</label>" +

        '<div class="tabs" role="tablist" aria-label="Filter by status">' + tabs + "</div>" +
        '<div class="filters" aria-label="Filter by field">' + filters + "</div>" +
        '<p class="list-count">Search, status tabs and field filters go live in M4. ' +
          "They are shown here for the layout.</p>" +

        '<div class="list">' + TOPICS.map(cardMarkup).join("") + "</div>" +
      "</div>";
  }

  function renderTopic(id) {
    var topic = TOPIC_BY_ID[id];
    var screen = document.getElementById("screen-topic");

    if (!topic) {
      screen.innerHTML = '<div class="empty"><h3>No such topic</h3>' +
        "<p>That link points somewhere not in this index.</p>" +
        '<p><a class="btn btn-quiet" href="#/library">Back to the index</a></p></div>';
      return;
    }
    screen.innerHTML = topicMarkup(topic, { titleId: "topic-h" });
  }

  function renderShuffle() {
    var deck = TOPICS.slice(0, 3).map(function (topic, i) {
      return '<div class="deck-card" data-cat="' + esc(topic.category) + '" data-depth="' + (2 - i) + '">' +
               '<span class="chip"><span class="chip-dot"></span>' +
                 esc(categoryOf(topic).label) + "</span>" +
               "<p>" + esc(topic.title) + "</p></div>";
    }).join("");

    var filters = CATEGORIES.map(function (cat) {
      return '<button class="chip" type="button" aria-disabled="true" data-cat="' + esc(cat.id) + '">' +
               '<span class="chip-dot"></span>' + esc(cat.label) + "</button>";
    }).join("");

    document.getElementById("screen-shuffle").innerHTML =
      '<div class="shuffle">' +
        '<header><p class="eyebrow" id="shuffle-h"><span class="eyebrow-mark"></span>Surprise me</p>' +
          '<h2 class="lede">A topic you have not marked yet, from one field or from all of them.</h2></header>' +
        '<div class="deck">' + deck + "</div>" +
        '<div class="deck-copy">' +
          '<button class="btn btn-primary" type="button" data-stub="M5">Roll from every field</button>' +
        "</div>" +
        '<div class="filters" aria-label="Roll within one field">' + filters + "</div>" +
        '<p class="list-count">Choosing and animation arrive in M5.</p>' +
      "</div>";
  }

  /* ------------------------------------------------------------- routing --- */
  /* Hash routes, because history.pushState is unavailable on file:// origins. */
  function parseRoute() {
    var parts = (location.hash || "#/today").replace(/^#\//, "").split("/");
    if (parts[0] === "topic" && parts[1]) return { screen: "topic", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "library") return { screen: "library" };
    if (parts[0] === "shuffle") return { screen: "shuffle" };
    return { screen: "today" };
  }

  function show(screen) {
    SCREENS.forEach(function (name) {
      var node = document.getElementById("screen-" + name);
      var active = name === screen;
      if (active) {
        node.hidden = false;
        node.setAttribute("data-active", "true");
      } else {
        node.removeAttribute("data-active");
        node.hidden = true;
      }
    });

    document.querySelectorAll(".tab").forEach(function (tab) {
      var isCurrent = tab.getAttribute("data-route") === screen ||
                      (tab.getAttribute("data-route") === "library" && screen === "topic");
      if (isCurrent) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  function render() {
    var route = parseRoute();

    if (route.screen === "today") renderToday();
    if (route.screen === "library") renderLibrary();
    if (route.screen === "shuffle") renderShuffle();
    if (route.screen === "topic") renderTopic(route.id);

    show(route.screen);
    document.getElementById("foot-count").textContent =
      TOPICS.length + " topics · " + CATEGORIES.length + " fields · sample content for M1";

    var dateNode = document.getElementById("masthead-date");
    if (dateNode) dateNode.textContent = shortDate(new Date());

    if (route.screen === "topic") {
      var title = TOPIC_BY_ID[route.id];
      document.title = (title ? title.title + " — " : "") + "daily-learn";
    } else {
      document.title = "daily-learn";
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ------------------------------------------------------------ binding --- */
  /* Marks are live within a session so their visual states can be reviewed now.
     TODO(M2): write through to localStorage and rebuild these two Sets on load. */
  function toggle(set, id) {
    if (set.has(id)) set.delete(id); else set.add(id);
  }

  function bindActions() {
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest ? event.target.closest("[data-act]") : null;
      if (!trigger) return;

      var id = trigger.getAttribute("data-id");
      if (!id) return;

      if (trigger.getAttribute("data-act") === "learnt") toggle(learnt, id);
      else toggle(starred, id);

      /* Re-render the whole screen: one pass over thirteen nodes, and it keeps
         the strip, the meter and the index rows in step with the mark. */
      render();
    });

    var close = document.getElementById("prototype-note-close");
    if (close) {
      close.addEventListener("click", function () {
        document.getElementById("prototype-note").remove();
      });
    }
  }

  function init() {
    initTheme();
    bindActions();
    window.addEventListener("hashchange", render);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
