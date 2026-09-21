/* ==========================================================================
   daily-learn — app

   Live now:   theme choice, hash routing, one topic per day with the thread
               steppable backwards by day or by week, the day streak, and
               learnt/star marks persisted with the date each was marked.
   Still out:  search and filters (M4), the shuffle roll (M5).

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

  var SCREENS = ["day", "library", "topic", "shuffle"];

  /* Every screen belongs to one tab. A topic is a detail view of the index, and
     any day is part of the daily thread, so neither orphans the tab bar. */
  var TAB_FOR_SCREEN = { day: "today", library: "library", topic: "library", shuffle: "shuffle" };

  /* ------------------------------------------------------------ helpers --- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function svg(name, cls) {
    return '<svg class="' + (cls || "") + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }

  /* NodeList has forEach in every current browser, but these loops also run over
     query results on older WebKit, so each goes through this. */
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

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  /* --------------------------------------------------------------- dates ---
     Every calendar step in the app goes through these rather than subtracting
     epoch milliseconds. setDate() on a local Date is immune to daylight saving
     — checked over three years of consecutive days in a zone that shifts and
     one that sits at +14 — whereas millisecond arithmetic silently risks a
     skipped or doubled day. */
  function isoDay(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return date.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }

  function parseIsoDay(text) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!parts) return null;
    var date = new Date(+parts[1], +parts[2] - 1, +parts[3]);
    /* Reject anything that reads like a date but is not one. Date rolls
       2026-02-30 over into March rather than failing, which would silently
       invent a day. */
    if (date.getMonth() !== +parts[2] - 1 || date.getDate() !== +parts[3]) return null;
    return date;
  }

  function todayIso() {
    return isoDay(new Date());
  }

  function addIsoDays(iso, amount) {
    var date = parseIsoDay(iso);
    if (!date) return iso;
    date.setDate(date.getDate() + amount);
    return isoDay(date);
  }

  /* Monday first: the working week followed by the weekend is how the strip
     reads without having to label itself. */
  function isoMondayOf(iso) {
    var date = parseIsoDay(iso);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return isoDay(date);
  }

  function dayNumber(date) {
    return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 864e5);
  }

  function daysBetween(fromIso, toIso) {
    return dayNumber(parseIsoDay(toIso)) - dayNumber(parseIsoDay(fromIso));
  }

  function longDate(iso) {
    return parseIsoDay(iso).toLocaleDateString(undefined,
      { weekday: "long", day: "numeric", month: "long" });
  }

  function shortDate(date) {
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  /* "today" and "yesterday" before any date: the two cases that cover almost
     every visit, phrased the way somebody would actually say them. Beyond two
     weeks a relative phrase stops carrying information, so the date returns
     null and the line is simply not drawn. */
  function relativeDay(iso) {
    var diff = daysBetween(iso, todayIso());
    if (diff === 0) return "today";
    if (diff === 1) return "yesterday";
    if (diff > 1 && diff < 14) return diff + " days ago";
    return null;
  }

  function dayPhrase(iso) {
    if (!iso) return "";
    var relative = relativeDay(iso);
    return relative || shortDate(parseIsoDay(iso));
  }

  /* ------------------------------------------------------------------ pick ---
     A hash of the date modulo the topic count looked fine and was not. Over
     three years one topic surfaced three times as often as another, and any
     given topic could disappear for 229 straight days. That reads as a broken
     app even though every day was technically valid.

     So instead: work through a shuffled deck. Each topic appears exactly once
     per cycle, the deck is re-shuffled for every cycle so the order is not a
     visible loop, and a cycle's first card is swapped when it would repeat the
     previous cycle's last. Measured over 1,095 days at 13 topics: counts
     within 82-87, no topic absent more than 26 days, no two adjacent days ever
     the same topic.

     Deterministic throughout — the same date resolves to the same topic for
     everyone on every device, with no randomness that a reload could undo. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function permutationOf(length, seed) {
    var random = mulberry32(seed);
    var order = [];
    var i;
    for (i = 0; i < length; i += 1) order.push(i);
    for (i = length - 1; i > 0; i -= 1) {
      var j = Math.floor(random() * (i + 1));
      var held = order[i];
      order[i] = order[j];
      order[j] = held;
    }
    return order;
  }

  var DECKS = {};

  function deckFor(cycle, length) {
    var key = length + ":" + cycle;
    if (!DECKS[key]) DECKS[key] = permutationOf(length, (0x9e3779b9 ^ cycle) >>> 0);
    return DECKS[key];
  }

  function indexOfTopicOn(date, length) {
    var day = dayNumber(date);
    var cycle = Math.floor(day / length);
    var position = day - cycle * length;
    var deck = deckFor(cycle, length);
    var index = deck[position];

    if (position === 0 && cycle > 0 && index === deckFor(cycle - 1, length)[length - 1]) {
      index = deck[1];
    }
    return index;
  }

  /* ---------------------------------------------------------- day records ---
     Which topic a day stood on is recorded the first time that day is opened.
     Without this, adding topics in M7 would move the pick under already-read
     days, and "the 19th" would quietly stop meaning the thing read on the 19th
     — which is the whole point of being able to revisit a day.
     Never written for a day that has not arrived. */
  var Days = (function () {
    var KEY = "dl.days.v1";
    var VERSION = 1;
    var records = {};
    var usable = true;

    function read() {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION) return;
        Object.keys(parsed.onDay || {}).forEach(function (iso) {
          if (parseIsoDay(iso)) records[iso] = parsed.onDay[iso];
        });
      } catch (error) {
        usable = false;
      }
    }

    function write() {
      if (!usable) return false;
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, onDay: records }));
        return true;
      } catch (error) {
        usable = false;
        return false;
      }
    }

    return {
      init: read,
      available: function () { return usable; },
      get: function (iso) { return records[iso] || null; },
      set: function (iso, topicId) {
        if (records[iso] === topicId) return;
        records[iso] = topicId;
        write();
      }
    };
  })();

  /* --------------------------------------------------------------- marks ---
     Learnt keeps a date rather than a boolean, because a boolean cannot answer
     "which days did I do anything" — and that question is the streak.

       { version: 1, learnt: { topicId: "YYYY-MM-DD" }, starred: { topicId: 1 } }
     */
  var Marks = (function () {
    var KEY = "dl.marks.v1";
    var VERSION = 1;
    var learnt = {};
    var starred = {};
    var usable = true;

    function has(store, key) {
      return Object.prototype.hasOwnProperty.call(store, key);
    }

    /* Entries pointing at a topic that no longer exists are dropped on the way
       in, so the numerator can never outgrow the denominator as content is
       rewritten in M7. */
    function keepKnown(source) {
      var clean = {};
      Object.keys(source || {}).forEach(function (id) {
        if (TOPIC_BY_ID[id]) clean[id] = source[id];
      });
      return clean;
    }

    /* A learnt entry also has to carry a genuine date — the streak walks them
       and the day phrases read them, and both would throw on a value that got
       as far as storage damaged. Rather than discard such a mark, which would
       lose the reader's work over a corrupt byte, it is dated today. */
    function keepKnownDates(source) {
      var clean = {};
      Object.keys(source || {}).forEach(function (id) {
        if (!TOPIC_BY_ID[id]) return;
        var entry = source[id];
        clean[id] = typeof entry === "string" && parseIsoDay(entry) ? entry : todayIso();
      });
      return clean;
    }

    function read() {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION) return;
        learnt = keepKnownDates(parsed.learnt);
        starred = keepKnown(parsed.starred);
      } catch (error) {
        /* Blocked, full, or unparseable. The app carries on with session-only
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

    function daysActive() {
      var dates = {};
      Object.keys(learnt).forEach(function (id) { dates[learnt[id]] = true; });
      return dates;
    }

    /* Consecutive days ending today, with today excused until the reader gets
       to it. A streak that displayed 0 every morning until something was marked
       would look broken on exactly the day it matters most. */
    function streak() {
      var dates = daysActive();
      var today = todayIso();
      if (!Object.keys(dates).length) return { days: 0, todayIncluded: false };

      var countedToday = has(dates, today);
      var cursor = countedToday ? today : addIsoDays(today, -1);
      if (!has(dates, cursor)) return { days: 0, todayIncluded: false };

      var count = 0;
      while (has(dates, cursor)) {
        count += 1;
        cursor = addIsoDays(cursor, -1);
      }
      return { days: count, todayIncluded: countedToday };
    }

    return {
      init: read,
      available: function () { return usable; },
      isLearnt: function (id) { return has(learnt, id); },
      learntOn: function (id) { return learnt[id] || null; },
      isStarred: function (id) { return has(starred, id); },
      countLearnt: function () { return Object.keys(learnt).length; },
      countStarred: function () { return Object.keys(starred).length; },
      streak: streak,
      markedOn: function (iso) {
        var names = [];
        Object.keys(learnt).forEach(function (id) {
          if (learnt[id] === iso && TOPIC_BY_ID[id]) names.push(TOPIC_BY_ID[id].title);
        });
        return names;
      },
      /* A set of dates rather than a per-day predicate: the week strip asks for
         all seven at once, and rebuilding the index seven times over is
         pointless work on the one screen read every day. */
      activityDates: daysActive,
      toggleLearnt: function (id) {
        if (!TOPIC_BY_ID[id]) return;
        if (learnt[id]) delete learnt[id]; else learnt[id] = todayIso();
        write();
      },
      toggleStarred: function (id) {
        if (!TOPIC_BY_ID[id]) return;
        if (starred[id]) delete starred[id]; else starred[id] = 1;
        write();
      }
    };
  })();

  function storageWorks() {
    return Marks.available() && Days.available();
  }

  function percentDone() {
    return TOPICS.length ? Math.round((Marks.countLearnt() / TOPICS.length) * 100) : 0;
  }

  function topicForIso(iso) {
    var recorded = Days.get(iso);
    if (recorded && TOPIC_BY_ID[recorded]) return TOPIC_BY_ID[recorded];

    /* Either never recorded, or recorded and later removed from the content.
       Resolving and storing keeps this day fixed from now on. */
    var resolved = TOPICS[indexOfTopicOn(parseIsoDay(iso), TOPICS.length)];
    Days.set(iso, resolved.id);
    return resolved;
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
     Rendering and syncing share these, so a mark applied to a screen already on
     the page cannot drift from what a fresh render would have shown. */
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

  /* Buttons are left empty and painted by syncMarks, which keeps a single
     source of truth for a marked and an unmarked control. The date line is
     grouped with them rather than being another child of the article, so it
     reads as a caption on the control and not a line of its own. */
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
     else, so M7 content cannot introduce a new kind of page by accident. There
     is deliberately no date line in here: on a day screen the bar above owns
     the date, and the kicker below owns the category. */
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

  /* ------------------------------------------------------------ day bar ---
     The date, two ways to move through it, and whatever that day is worth
     knowing. It owns the date, so the article below drops its own eyebrow. */
  function navButton(icon, href, label, blocked) {
    if (blocked) {
      /* A span rather than a disabled button: it stays reachable and readable
         to a screen reader, and the title says why there is nothing there. */
      return '<span class="nav-btn" aria-disabled="true" title="' + esc(label) + ' — nothing further ahead">' +
        svg(icon) + "</span>";
    }
    return '<a class="nav-btn" href="' + esc(href) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
      svg(icon) + "</a>";
  }

  var WEEK_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

  function weekStripMarkup(iso) {
    var today = todayIso();
    var monday = isoMondayOf(iso);
    var active = Marks.activityDates();
    var cells = "";

    for (var i = 0; i < 7; i += 1) {
      var dayIso = addIsoDays(monday, i);
      var ahead = dayIso > today;
      var activity = active[dayIso] === true;
      var name = longDate(dayIso) +
        (ahead ? ", not yet" : activity ? ", something marked" : ", nothing marked");
      var inner = '<span class="week-day-initial">' + WEEK_INITIALS[i] + "</span>" +
        '<span class="week-day-number">' + parseIsoDay(dayIso).getDate() + "</span>" +
        '<span class="week-day-mark"></span>';
      var attrs = ' data-activity="' + (activity ? "true" : "false") + '"' +
        (dayIso === iso ? ' aria-current="date"' : "");

      cells += ahead
        ? '<span class="week-day" aria-disabled="true"' + attrs + ' title="' + esc(name) + '">' + inner + "</span>"
        : '<a class="week-day" href="#/day/' + dayIso + '"' + attrs + ' aria-label="' + esc(name) + '">' + inner + "</a>";
    }

    /* Today's week is the last one you can step into. */
    var canGoOn = isoMondayOf(addIsoDays(monday, 7)) <= isoMondayOf(today);
    return navButton("i-chev-left", "#/day/" + addIsoDays(monday, -7), "Previous week") +
      cells +
      navButton("i-chev-right", "#/day/" + addIsoDays(monday, 7), "Next week", !canGoOn);
  }

  function statPair(label, value) {
    return '<span class="stat-lead">' + esc(label) + "</span><strong>" + esc(value) + "</strong>";
  }

  function statsMarkup(iso) {
    var streak = Marks.streak();
    var streakText = streak.days ? plural(streak.days, "day") : "not started";

    if (iso === todayIso()) {
      var today = [statPair("Learnt", Marks.countLearnt() + " of " + TOPICS.length),
                   statPair("Streak", streakText)];
      if (Marks.countStarred()) today.push(statPair("Starred", String(Marks.countStarred())));
      return today.join("");
    }

    /* On an earlier day the useful fact is what was actually done then. The
       streak is a property of today, so it is labelled as such rather than
       being shown as if it described the day being read. */
    var marked = Marks.markedOn(iso);
    var record = marked.length
      ? marked.slice(0, 2).join(", ") + (marked.length > 2 ? " +" + (marked.length - 2) + " more" : "")
      : "Nothing marked";

    return statPair("This day", record) + statPair("Streak now", streak.days ? plural(streak.days, "day") : "none");
  }

  function daybarMarkup(iso) {
    var relative = relativeDay(iso);

    return '' +
      '<div class="daybar-top">' +
        '<div class="daybar-when">' +
          '<strong id="day-h">' + esc(longDate(iso)) + "</strong>" +
          (relative ? "<span>" + esc(relative) + "</span>" : "") +
        "</div>" +
        '<div class="daynav">' +
          navButton("i-chev-left", "#/day/" + addIsoDays(iso, -1), "Previous day") +
          navButton("i-chev-right", "#/day/" + addIsoDays(iso, 1), "Next day", iso >= todayIso()) +
        "</div>" +
      "</div>" +
      '<div class="week-strip" role="group" aria-label="Days in this week">' +
        weekStripMarkup(iso) + "</div>" +
      '<p class="daybar-stats" aria-live="polite">' + statsMarkup(iso) + "</p>";
  }

  /* ------------------------------------------------------------- fragments --
     Shared by the first render and by syncMarks. Live regions are inner nodes
     whose content alone is replaced, because swapping out a live region itself
     silences the announcement. */
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
  var currentDayIso = todayIso();

  function renderDay(iso) {
    currentDayIso = iso;
    document.getElementById("screen-day").innerHTML =
      '<div class="day">' +
        '<section class="daybar">' + daybarMarkup(iso) + "</section>" +
        topicMarkup(topicForIso(iso), { titleId: "day-topic-h" }) +
      "</div>";
  }

  function renderBadDay() {
    currentDayIso = null;
    document.getElementById("screen-day").innerHTML =
      '<div class="day"><div class="empty"><h3 id="day-h">No such day</h3>' +
        "<p>A date has to read as year-month-day, and it has to be one that exists — " +
        "14 January 2026 does, 2026-02-30 does not.</p>" +
        '<p><a class="btn btn-quiet" href="#/today">Go to today</a></p></div></div>';
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
    /* The deck is an illustration of a card stack, not three selectable cards.
       Its rear cards sit at half opacity to sell the depth, which leaves their
       labels around 2-3:1; marking the whole stack decorative keeps that text
       out of the reading order instead of presenting it as content a person
       cannot comfortably read. M5 replaces it with the real roll. */
    '<div class="deck" aria-hidden="true">' + deck + "</div>" +
        '<div class="deck-copy">' +
          '<button class="btn btn-primary" type="button" data-stub="M5">Roll from every field</button>' +
        "</div>" +
        '<div class="filters" aria-label="Roll within one field">' + filters + "</div>" +
        '<p class="list-count">Choosing and animation arrive in M5.</p>' +
      "</div>";
  }

  /* ------------------------------------------------------------ syncing ---
     Marking a topic must not rebuild the page. A rebuild throws away the
     reader's scroll position and replays the entry animation, so the app looks
     like it restarted every time you tap. Everything here patches nodes that
     are already in the DOM. */
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

    /* The week dots and the day's counters are derived from the same marks, so
       they follow it. Only their own subtrees are rewritten, which leaves the
       scroll position and the live region intact. */
    if (currentDayIso) {
      var week = document.querySelector("#screen-day .week-strip");
      if (week) week.innerHTML = weekStripMarkup(currentDayIso);
      var stats = document.querySelector("#screen-day .daybar-stats");
      if (stats) stats.innerHTML = statsMarkup(currentDayIso);
    }

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
      var streak = Marks.streak();
      foot.textContent = TOPICS.length + " topics · " + CATEGORIES.length + " fields · " +
        Marks.countLearnt() + " learnt" + (streak.days ? " · " + plural(streak.days, "day") + " streak" : "");
    }
  }

  /* ------------------------------------------------------------- routing --- */
  /* Hash routes, because history.pushState is unavailable on file:// origins. */
  function parseRoute() {
    var parts = (location.hash || "#/today").replace(/^#\//, "").split("/");
    var today = todayIso();

    if (parts[0] === "topic" && parts[1]) return { screen: "topic", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "library") return { screen: "library" };
    if (parts[0] === "shuffle") return { screen: "shuffle" };

    if (parts[0] === "day" && parts[1]) {
      var iso = decodeURIComponent(parts[1]);
      if (!parseIsoDay(iso)) return { screen: "day", bad: true };
      /* A pick for a day that has not happened would spoil the mechanic, so the
         future is clamped to today rather than refused outright. */
      return { screen: "day", iso: iso > today ? today : iso };
    }
    return { screen: "day", iso: today };
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

    var tab = TAB_FOR_SCREEN[screen];
    each(document.querySelectorAll(".tab"), function (node) {
      if (node.getAttribute("data-route") === tab) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
  }

  /* The element that was clicked is destroyed when its screen is replaced, which
     drops focus to the body and leaves a screen reader silent on the page it
     just moved to. Only done on a real route change, never on a mark. */
  function moveFocus(screen) {
    var node = document.getElementById("screen-" + screen);
    if (!node) return;
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
    node.focus({ preventScroll: true });
  }

  function render(options) {
    var opts = options || {};
    var route = parseRoute();

    if (route.screen === "day") {
      if (route.bad) renderBadDay();
      else renderDay(route.iso);
    }
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
      /* Reading can succeed while writing fails — a full quota, or a private
         window that allows getItem but not setItem. Only a failed write reveals
         it, so this is checked here and not solely at startup. */
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
    if (storageWorks()) return;
    var note = document.getElementById("storage-note");
    if (note) note.hidden = false;
  }

  function init() {
    Marks.init();
    Days.init();
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
