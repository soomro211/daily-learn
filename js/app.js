/* ==========================================================================
   daily-learn — app

   Live now:   theme choice, hash routing, the deterministic daily pick, and
               learnt/star marks persisted to localStorage with the date each
               topic was marked — M3 reads those dates for the day streak.
   Still out:  search and filters (M4), the shuffle roll (M5), the calendar and
               the streak calculation itself (M3).

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

  /* NodeList has forEach in every current browser, but these loops also run
     over arrays returned by querySelectorAll on older WebKit, so each goes
     through this rather than assuming. */
  function each(nodes, fn) {
    Array.prototype.forEach.call(nodes, fn);
  }

  function categoryOf(topic) {
    return CATEGORY_BY_ID[topic.category] || { id: topic.category, label: topic.category };
  }

  function domainOf(url) {
    var match = /^https?:\/\/([^/]+)/.exec(url);
    return match ? match[1].replace(/^www\./, "") : "";
  }

  /* Local calendar fields, never UTC: a daily pick that shifted at midnight in
     someone else's timezone would read as a bug. */
  function dayNumber(date) {
    return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 864e5);
  }

  function isoDay(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return date.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }

  function parseIsoDay(text) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : null;
  }

  function shortDate(date) {
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function longDate(date) {
    return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }

  /* "today" and "yesterday" before a date: the two cases that cover almost
     every tap, phrased the way somebody would actually say them. */
  function dayPhrase(iso) {
    var date = parseIsoDay(iso);
    if (!date) return "";
    var diff = dayNumber(new Date()) - dayNumber(date);
    if (diff === 0) return "today";
    if (diff === 1) return "yesterday";
    return shortDate(date);
  }

  /* Deterministic for the day and spread across the set — the same date gives
     everyone the same topic, and it survives a reload because nothing is
     random about it. */
  function indexForDay(date, length) {
    var h = (dayNumber(date) * 2654435761) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) % length;
  }

  function topicOfTheDay(date) {
    return TOPICS[indexForDay(date || new Date(), TOPICS.length)];
  }

  function percentDone() {
    var total = TOPICS.length;
    return total ? Math.round((Marks.countLearnt() / total) * 100) : 0;
  }

  /* --------------------------------------------------------------- marks ---
     One store for both marks. Learnt keeps a date rather than a boolean,
     because a boolean cannot answer "which days did I learn things" — and that
     is exactly what the M3 streak needs, so recording it now avoids a
     migration later.

       { version: 1, learnt: { topicId: "YYYY-MM-DD" }, starred: { topicId: 1 } }
     */
  var Marks = (function () {
    var KEY = "dl.marks.v1";
    var VERSION = 1;
    var learnt = {};
    var starred = {};
    var usable = true;

    function has(store, id) {
      return Object.prototype.hasOwnProperty.call(store, id);
    }

    /* Anything pointing at a topic that no longer exists is dropped on the way
       in, so the numerator can never outgrow the denominator as content is
       rewritten in M7. */
    function prune(source) {
      var clean = {};
      Object.keys(source || {}).forEach(function (id) {
        if (TOPIC_BY_ID[id]) clean[id] = source[id];
      });
      return clean;
    }

    function read() {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION || typeof parsed !== "object") return;
        learnt = prune(parsed.learnt);
        starred = prune(parsed.starred);
      } catch (error) {
        /* Blocked, full, or unparseable. The app keeps working with session-only
           marks and the storage note says so out loud. */
        usable = false;
      }
    }

    function write() {
      if (!usable) return false;
      try {
        window.localStorage.setItem(KEY, JSON.stringify({
          version: VERSION, learnt: learnt, starred: starred
        }));
        return true;
      } catch (error) {
        usable = false;
        return false;
      }
    }

    return {
      init: read,
      available: function () { return usable; },
      isLearnt: function (id) { return has(learnt, id); },
      learntOn: function (id) { return learnt[id] || null; },
      isStarred: function (id) { return has(starred, id); },
      countLearnt: function () { return Object.keys(learnt).length; },
      countStarred: function () { return Object.keys(starred).length; },
      toggleLearnt: function (id) {
        if (!TOPIC_BY_ID[id]) return;
        if (learnt[id]) delete learnt[id]; else learnt[id] = isoDay(new Date());
        write();
      },
      toggleStarred: function (id) {
        if (!TOPIC_BY_ID[id]) return;
        if (starred[id]) delete starred[id]; else starred[id] = 1;
        write();
      }
    };
  })();

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
      try { localStorage.setItem("dl.theme", next); } catch (e) { /* blocked */ }
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

  /* -------------------------------------------------------- button paint ---
     Rendering and syncing share these two, so a mark applied to a screen that
     is already on the page cannot drift from what a fresh render would show. */
  function learntState(button, isLearnt) {
    if (!button) return;
    var justMarked = isLearnt && button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", isLearnt ? "true" : "false");
    button.setAttribute("title", isLearnt
      ? "Marked as learnt — tap to undo"
      : "Mark this topic as learnt");
    button.innerHTML = (isLearnt ? svg("i-check") : "") +
      "<span>" + (isLearnt ? "Learnt" : "Mark as learnt") + "</span>";
    if (justMarked) pop(button);
  }

  function starState(button, isStarred) {
    if (!button) return;
    var justMarked = isStarred && button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", isStarred ? "true" : "false");
    button.setAttribute("aria-label", isStarred ? "Remove from starred" : "Add to starred");
    button.innerHTML = svg("i-star");
    if (justMarked) pop(button);
  }

  /* A short scale-in on the icon. Without it a tap that only changes a word
     reads as a button that did nothing. */
  function pop(button) {
    var icon = button.querySelector("svg");
    if (!icon || !icon.addEventListener) return;
    icon.setAttribute("data-pop", "true");
    icon.addEventListener("animationend", function () {
      icon.removeAttribute("data-pop");
    }, { once: true });
  }

  /* Buttons are left empty and painted by syncMarks, which keeps one source of
     truth for what a marked and an unmarked control look like. The date line is
     grouped with them rather than being another child of the article, so it
     reads as a caption on the control rather than a line of its own. */
  function actionsMarkup(id) {
    return '<div class="action-block">' +
        '<div class="topic-actions">' +
          '<button class="btn btn-primary" type="button" data-act="learnt" data-id="' + esc(id) + '"></button>' +
          '<button class="btn btn-icon" type="button" data-act="star" data-id="' + esc(id) + '"></button>' +
        "</div>" +
        '<p class="marked-note" hidden>' + svg("i-check") +
          '<span class="marked-note-text"></span></p>' +
      "</div>";
  }

  /* --------------------------------------------------------- topic markup ---
     The shape every topic takes. Fields come from data/topics.js and nowhere
     else, so M7 content cannot accidentally introduce a new kind of page. */
  function topicMarkup(topic, options) {
    var opts = options || {};
    var cat = categoryOf(topic);

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
      '<article class="topic" data-topic="' + esc(topic.id) + '" data-cat="' + esc(topic.category) + '">' +
        '<header class="topic-head">' +
          (opts.back
            ? '<a class="back" href="' + esc(opts.back) + '">' + svg("i-chev-left") + "All topics</a>"
            : "") +
          (opts.eyebrow ? '<p class="eyebrow">' + opts.eyebrow + "</p>" : "") +
          '<h1 class="topic-title" id="' + esc(opts.titleId || "topic-h") + '">' + esc(topic.title) + "</h1>" +
          '<div class="topic-kicker"><span class="chip"><span class="chip-dot"></span>' +
            esc(cat.label) + '</span><hr class="hairline"></div>' +
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

        actionsMarkup(topic.id) +

        (related
          ? '<section class="related"><h2 class="block-label">Related topics</h2>' +
            '<div class="related-list">' + related + "</div></section>"
          : "") +
      "</article>";
  }

  /* ------------------------------------------------------------- fragments --
     Shared by the first render and by syncMarks. The live regions are inner
     nodes whose text alone is replaced, because swapping out a live region
     itself silences the announcement. */
  function stripMarkup() {
    var now = new Date();
    var monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    var dots = "";
    for (var i = 0; i < 7; i += 1) {
      var day = new Date(monday);
      day.setDate(monday.getDate() + i);
      /* Only today is lit. TODO(M3): light the days that carry a learnt date —
         the data for that is already being recorded. */
      dots += "<i" + (dayNumber(day) === dayNumber(now) ? ' data-today="true"' : "") + "></i>";
    }

    return '' +
      '<div class="strip-stat">' +
        '<span class="strip-value" aria-live="polite"><span data-stat="learnt">' +
          Marks.countLearnt() + "</span><small>/ " + TOPICS.length + "</small></span>" +
        '<span class="strip-label">Learnt</span>' +
      "</div>" +
      '<div class="strip-stat">' +
        '<span class="strip-value" aria-live="polite"><span data-stat="starred">' +
          Marks.countStarred() + "</span></span>" +
        '<span class="strip-label">Starred</span>' +
      "</div>" +
      '<div class="strip-stat">' +
        '<span class="strip-value"><span class="week">' + dots + "</span></span>" +
        '<span class="strip-label">This week</span>' +
      "</div>";
  }

  function meterMarkup() {
    return '<div class="meter-head"><span>Learnt so far</span>' +
        '<span class="meter-count" aria-live="polite"><span data-stat="meter">' +
          Marks.countLearnt() + "</span> of " + TOPICS.length + "</span></div>" +
      '<div class="meter-track"><span class="meter-fill" style="width:' + percentDone() + '%"></span></div>';
  }

  function cardMarkup(topic) {
    var cat = categoryOf(topic);
    return '<a class="card" href="#/topic/' + esc(topic.id) + '"' +
             ' data-topic="' + esc(topic.id) + '" data-cat="' + esc(topic.category) + '">' +
             '<span class="chip"><span class="chip-dot"></span>' + esc(cat.label) + "</span>" +
             '<h3 class="card-title">' + esc(topic.title) + "</h3>" +
             '<p class="card-excerpt">' + esc(topic.summary) + "</p>" +
             '<span class="card-foot">' +
               '<span class="source-site">' + esc(domainOf(topic.source.url)) + "</span>" +
               '<span class="marks">' +
                 '<span class="mark-learnt" hidden title="Learnt">' + svg("i-check") + "</span>" +
                 '<span class="mark-star" hidden title="Starred">' + svg("i-star") + "</span>" +
               "</span>" +
             "</span>" +
           "</a>";
  }

  /* -------------------------------------------------------------- screens --- */
  function renderToday() {
    var now = new Date();
    var topic = topicOfTheDay(now);

    document.getElementById("screen-today").innerHTML =
      '<div class="today">' +
        '<section class="today-strip">' + stripMarkup() + "</section>" +
        topicMarkup(topic, {
          titleId: "today-h",
          eyebrow: '<span class="eyebrow-mark"></span>' + esc(longDate(now)) + " · today's topic"
        }) +
      "</div>";
  }

  function renderLibrary() {
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
        '<div class="meter">' + meterMarkup() + "</div>" +
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
    var screen = document.getElementById("screen-topic");
    var topic = TOPIC_BY_ID[id];

    if (!topic) {
      screen.innerHTML = '<div class="empty"><h3 id="topic-h">No such topic</h3>' +
        "<p>That link points somewhere not in this index.</p>" +
        '<p><a class="btn btn-quiet" href="#/library">Back to the index</a></p></div>';
      return;
    }
    screen.innerHTML = topicMarkup(topic, { titleId: "topic-h", back: "#/library" });
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

  /* ------------------------------------------------------------ syncing ---
     Marking a topic must not rebuild the page. A rebuild throws away the
     reader's scroll position and replays the entrance animation, so the app
     appears to have restarted every time you tap. Everything here patches the
     nodes that are already in the DOM. */
  function syncMarks() {
    each(document.querySelectorAll(".topic"), function (node) {
      var id = node.getAttribute("data-topic");
      if (!id) return;

      var isLearnt = Marks.isLearnt(id);
      learntState(node.querySelector('[data-act="learnt"]'), isLearnt);
      starState(node.querySelector('[data-act="star"]'), Marks.isStarred(id));

      var note = node.querySelector(".marked-note");
      if (note) {
        note.hidden = !isLearnt;
        if (isLearnt) {
          note.querySelector(".marked-note-text").textContent =
            "Marked learnt · " + dayPhrase(Marks.learntOn(id));
        }
      }
    });

    var learntOut = document.querySelector('#screen-today [data-stat="learnt"]');
    if (learntOut) learntOut.textContent = Marks.countLearnt();
    var starredOut = document.querySelector('#screen-today [data-stat="starred"]');
    if (starredOut) starredOut.textContent = Marks.countStarred();

    var meterOut = document.querySelector('#screen-library [data-stat="meter"]');
    if (meterOut) meterOut.textContent = Marks.countLearnt();
    var fill = document.querySelector("#screen-library .meter-fill");
    if (fill) fill.style.width = percentDone() + "%";

    each(document.querySelectorAll("#screen-library .card"), function (card) {
      var id = card.getAttribute("data-topic");
      if (!id) return;
      var isLearnt = Marks.isLearnt(id);
      card.setAttribute("data-learnt", isLearnt ? "true" : "false");
      var learntMark = card.querySelector(".mark-learnt");
      var starMark = card.querySelector(".mark-star");
      if (learntMark) learntMark.hidden = !isLearnt;
      if (starMark) starMark.hidden = !Marks.isStarred(id);
    });

    var foot = document.getElementById("foot-count");
    if (foot) {
      foot.textContent = TOPICS.length + " topics · " + CATEGORIES.length + " fields · " +
        Marks.countLearnt() + " learnt";
    }
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
      if (name === screen) {
        node.hidden = false;
        node.setAttribute("data-active", "true");
      } else {
        node.removeAttribute("data-active");
        node.hidden = true;
      }
    });

    each(document.querySelectorAll(".tab"), function (tab) {
      var route = tab.getAttribute("data-route");
      var isCurrent = route === screen || (route === "library" && screen === "topic");
      if (isCurrent) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  /* The element that was clicked is destroyed when its screen is replaced,
     which drops focus to the body and leaves a screen reader silent on the page
     it just moved to. Only done on a real route change, never on a mark. */
  function moveFocus(screen) {
    var node = document.getElementById("screen-" + screen);
    if (!node) return;
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
    node.focus({ preventScroll: true });
  }

  function render(options) {
    var opts = options || {};
    var route = parseRoute();

    if (route.screen === "today") renderToday();
    if (route.screen === "library") renderLibrary();
    if (route.screen === "shuffle") renderShuffle();
    if (route.screen === "topic") renderTopic(route.id);

    show(route.screen);
    syncMarks();

    var dateNode = document.getElementById("masthead-date");
    if (dateNode) dateNode.textContent = shortDate(new Date());

    var topic = route.screen === "topic" ? TOPIC_BY_ID[route.id] : null;
    document.title = (topic ? topic.title + " — " : "") + "daily-learn";

    window.scrollTo({ top: 0, behavior: "auto" });
    if (opts.navigate) moveFocus(route.screen);
  }

  /* ------------------------------------------------------------ binding --- */
  function bindActions() {
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest ? event.target.closest("[data-act]") : null;
      if (!trigger) return;

      var id = trigger.getAttribute("data-id");
      if (!id) return;

      if (trigger.getAttribute("data-act") === "learnt") Marks.toggleLearnt(id);
      else Marks.toggleStarred(id);

      syncMarks();
      /* Reading can succeed while writing fails — a full quota or a private
         window that allows getItem but not setItem. Only a failed write reveals
         it, so the warning is checked here rather than solely at startup. */
      showStorageNote();
    });

    var close = document.getElementById("prototype-note-close");
    if (close) {
      close.addEventListener("click", function () {
        document.getElementById("prototype-note").remove();
      });
    }
  }

  function showStorageNote() {
    if (Marks.available()) return;
    var note = document.getElementById("storage-note");
    if (note) note.hidden = false;
  }

  function init() {
    Marks.init();
    initTheme();
    bindActions();
    showStorageNote();
    /* Wrapped, not passed directly: hashchange hands render() an event object,
       which would be read as the options argument. */
    window.addEventListener("hashchange", function () { render({ navigate: true }); });
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
