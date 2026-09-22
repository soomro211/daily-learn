/* ==========================================================================
   daily-learn — app

   Live now:   theme choice, hash routing, one topic per day with the thread
               steppable backwards by day or by week, the day streak, and
               learnt/star marks persisted with the date each was marked. The
               index searches, filters by field and splits by status. The
               shuffle deals an unmarked topic out of a stack that will not
               repeat itself before it runs out.
   Still out:  the real content (M7).

   Classic script, no modules: the app has to open straight from the
   filesystem, where module loading and fetch() are both blocked.
   ========================================================================== */

(function () {
  "use strict";

  var ROOT = document.documentElement;

  /* M7 is about 120 hand-written entries. Without a gate, one topic missing its
     source would throw while the index was being built — mid-string, so the whole
     screen comes up empty and the cause is a single field on one row. Filtering
     once at startup means a bad entry costs itself and says so, instead of
     costing the page. Ids must be strings because they travel through attributes
     and hrefs, where a number would not read back the same. */
  function usableTopic(topic) {
    return !!(topic && typeof topic.id === "string" && typeof topic.title === "string" &&
      typeof topic.category === "string" && typeof topic.summary === "string" &&
      topic.source && typeof topic.source.url === "string" && topic.source.url &&
      typeof topic.source.label === "string" && topic.source.label);
  }

  var CATEGORIES = (window.DL_CATEGORIES || []).filter(function (cat) {
    return cat && typeof cat.id === "string" && typeof cat.label === "string";
  });

  var CATEGORY_BY_ID = {};
  CATEGORIES.forEach(function (c) { CATEGORY_BY_ID[c.id] = c; });

  var TOPICS = [];
  var TOPIC_BY_ID = {};

  (window.DL_TOPICS || []).forEach(function (topic) {
    if (!usableTopic(topic)) {
      console.warn("daily-learn: dropped a topic that is missing a required field",
        topic && topic.id ? topic.id : topic);
      return;
    }
    if (TOPIC_BY_ID[topic.id]) {
      /* Two rows sharing an id would open the same page and share one mark, so
         the second is the one that loses. */
      console.warn("daily-learn: dropped a second topic with the id " + topic.id);
      return;
    }
    TOPICS.push(topic);
    TOPIC_BY_ID[topic.id] = topic;
  });

  if (!TOPICS.length) {
    console.warn("daily-learn: no usable topics were found, so every screen is empty");
  }

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

  /* location.hash arrives still percent-encoded, so every route segment is read
     through this. A bare decodeURIComponent throws on a stray "%", and inside
     render() that would take the whole app down over one mistyped character. */
  function decodeBit(text) {
    try { return decodeURIComponent(text); } catch (error) { return ""; }
  }

  /* Lowercased, with accents separated off and dropped, so a query typed without
     diacritics still finds text written with them: the index says "Sèvres" and a
     search for "sevres" has to reach it. Used on both sides of the comparison.

     Apostrophes are dropped outright rather than left in place, because they sit
     inside a word rather than between two: "Occam's razor" has to be reachable as
     "occams razor", which is both how most people type it and how the topic's own
     id is spelled. Splitting on the apostrophe instead — which is what the token
     list does — leaves "occam" and "s" in the text and "occams" in the query, and
     the two never meet.

     The dropped range is U+0300 to U+036F, the combining diacritical marks that
     NFD decomposition splits away from a precomposed letter. Written as a loop
     over code points rather than a regex character range because the range's
     endpoints are invisible marks, which makes a regex unreadable in source and
     easy to corrupt. */
  function fold(text) {
    var lower = String(text == null ? "" : text).toLowerCase();
    if (!lower.normalize) return lower;
    var decomposed = lower.normalize("NFD");
    var kept = "";
    for (var i = 0; i < decomposed.length; i += 1) {
      var code = decomposed.charCodeAt(i);
      if (code >= 0x300 && code <= 0x36f) continue;
      if (code === 0x27 || code === 0x2019 || code === 0x02bc) continue;
      kept += decomposed.charAt(i);
    }
    return kept;
  }

  /* Split on anything that is not a letter or a digit rather than matching the
     whole string. This is what lets "dunning kruger" find a title written with an
     en dash; the apostrophe case is handled by fold, which removes it before the
     split rather than treating it as a break.

     Single characters are dropped: matching is by substring, so an "s" left over
     from an apostrophe would be satisfied by any word containing one — a
     constraint that appears to narrow the list while never doing so. A query of
     pure punctuation yields no tokens and is treated as no query at all, which is
     kinder than an empty screen. */
  function tokensOf(text) {
    var parts = fold(text).split(/[^a-z0-9]+/);
    var tokens = [];
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].length > 1) tokens.push(parts[i]);
    }
    return tokens;
  }

  /* --------------------------------------------------------------- dates ---
     Every calendar step in the app goes through these rather than subtracting
     epoch milliseconds. setDate() on a local Date is immune to daylight saving
     — checked over three years of consecutive days in a zone that shifts and
     one that sits at +14 — whereas millisecond arithmetic silently risks a
     skipped or doubled day. Counting days is a different job and has its own
     trap; see dayNumber. */
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

  /* The number of a calendar day, counted from the epoch in UTC so that it is the
     same integer for the same date in every zone. Dividing a *local* midnight by
     a day's milliseconds — which this function used to do — is not: in a zone
     whose offset straddles UTC, spring-forward pulls the next midnight back into
     the previous UTC day, so London got 2026-03-29 and 03-30 the same number
     (one topic on two consecutive days, and the deck cycle shifting) and skipped
     a whole number on 2026-10-26. Measured over 1,200 consecutive days in nine
     zones: 14 broken steps this way, 0 the Date.UTC way. */
  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
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

     So instead: work through a shuffled deck. Each topic appears exactly once per
     cycle, the deck is re-shuffled for every cycle so the order is not a visible
     loop, and a cycle's first card is swapped with its second when it would repeat
     the previous cycle's last. Measured over 4,000 consecutive days at 13, 60, 120
     and 150 topics: zero adjacent repeats, every topic exactly once per cycle, and
     the longest absence under two cycles — which at 120 topics means a given idea
     can stay unseen for about eight months before the deck reshuffles. That is the
     cost of exact fairness, and it is the right trade for an index meant to be
     worked through rather than mined for a hit. Re-checked in twelve timezones by
     tests/day-arithmetic.js, which is what found the substitution defect this
     replaced.

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

  /* A cycle's first card must not repeat the previous cycle's last. The two are
     swapped rather than one being substituted for the other: substituting leaves
     the replacement at its own position as well, which both shows the same topic
     on two consecutive days and drops the swapped-away topic from the cycle
     entirely. A swap moves nothing in or out, so the deck stays a permutation and
     every topic still appears exactly once per cycle. Only positions 0 and 1 are
     involved, and the previous cycle's last card is never one of them, so this
     test never has to look back further than one cycle. */
  function indexOfTopicOn(date, length) {
    var day = dayNumber(date);
    var cycle = Math.floor(day / length);
    var position = day - cycle * length;
    var deck = deckFor(cycle, length);

    if (cycle > 0 && length > 1 && position < 2 &&
        deck[0] === deckFor(cycle - 1, length)[length - 1]) {
      return deck[1 - position];
    }
    return deck[position];
  }

  /* ---------------------------------------------------------- day records ---
     Which topic a day stood on is recorded the first time that day is opened.
     Without this, adding topics in M7 would move the pick under already-read
     days, and "the 19th" would quietly stop meaning the thing read on the 19th
     — which is the whole point of being able to revisit a day.
     Never written for a day that has not arrived. */
  var Days = (function () {
    var VERSION = 1;
    var KEY = "dl.days.v" + VERSION;
    var records = {};
    var usable = true;

    function read() {
      var raw = null;
      try {
        raw = window.localStorage.getItem(KEY);
      } catch (error) {
        usable = false;
        return;
      }
      if (!raw) return;
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION) return;
        Object.keys(parsed.onDay || {}).forEach(function (iso) {
          if (parseIsoDay(iso)) records[iso] = parsed.onDay[iso];
        });
      } catch (error) {
        /* Unreadable, not unavailable: start clean so the day pinning carries on
           working and the next write repairs the key. */
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
    var VERSION = 1;
    /* The key carries the version, so a bump starts a fresh store rather than
       reading the old shape, finding it unusable, and then overwriting it. */
    var KEY = "dl.marks.v" + VERSION;
    var learnt = {};
    var starred = {};
    var usable = true;

    /* Bumped by anything that changes a mark. Screens read it as the cache key for
       "has anything derived from marks moved", which is what lets the index skip
       rebuilding itself on a route change that moved no marks at all. Named apart
       from VERSION above, which is the storage format and a different thing. */
    var revision = 0;

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
      var raw = null;
      try {
        raw = window.localStorage.getItem(KEY);
      } catch (error) {
        /* Reading is refused outright: a browser that blocks storage, where
           session-only marks and the note about them are the right outcome. */
        usable = false;
        return;
      }
      if (!raw) return;
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION) return;
        learnt = keepKnownDates(parsed.learnt);
        starred = keepKnown(parsed.starred);
      } catch (error) {
        /* The bytes are there and unreadable. Start from empty and let the next
           write replace them — the previous handling gave up on persistence for
           the rest of the profile here, so one damaged character would quietly
           cost the reader every mark they made from then on. */
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
      revision: function () { return revision; },
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
        revision += 1;
      },
      toggleStarred: function (id) {
        if (!TOPIC_BY_ID[id]) return;
        if (starred[id]) delete starred[id]; else starred[id] = 1;
        write();
        revision += 1;
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
     the page cannot drift from what a fresh render would have shown.

     Both take an empty button as a first paint rather than a change. Without
     that, opening a topic learnt last week plays the pop animation, because the
     aria-pressed attribute being looked up to decide "did this just change" does
     not exist yet on a node that has never been painted — so the app appears to
     confirm an action the reader never took. */
  function learntState(button, isLearnt) {
    if (!button) return;
    var justMarked = isLearnt && !!button.firstChild &&
      button.getAttribute("aria-pressed") !== "true";
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
    var justMarked = isStarred && !!button.firstChild &&
      button.getAttribute("aria-pressed") !== "true";
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
            ? '<a class="back" href="' + esc(opts.back) + '">' + svg("i-chev-left") + "Back to the index</a>"
            : "") +
          '<h1 class="topic-title" id="' + esc(opts.titleId || "topic-h") + '">' + esc(topic.title) + "</h1>" +
          /* The category is a link rather than a label, because a reader who likes
             one topic wants the rest of its field, and the index already has a view
             for exactly that. */
          '<div class="topic-kicker"><a class="chip" href="' + esc(libraryRoute("all", topic.category)) +
            '" data-cat="' + esc(topic.category) + '" title="' + esc("Show every " + cat.label + " topic") + '">' +
            '<span class="chip-dot"></span>' + esc(cat.label) + '</a><hr class="hairline"></div>' +
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

  /* One box per pair. Two flex items separated by the same gap that sits between
     them and inside them reads as a run-on — "LEARNT 0 of 13 STREAK not started"
     gives the eye nothing to group by, which is how it looked on a phone. */
  function statPair(label, value, prose) {
    return '<span class="stat"><span class="stat-lead">' + esc(label) + "</span>" +
      "<strong" + (prose ? ' class="stat-prose"' : "") + ">" + esc(value) + "</strong></span>";
  }

  function statsMarkup(iso) {
    var streak = Marks.streak();
    var streakText = streak.days ? plural(streak.days, "day") : "not started";

    if (iso === todayIso()) {
      var today = [statPair("Learnt", Marks.countLearnt() + " of " + TOPICS.length),
                   statPair("Streak", streakText, true)];
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

    return statPair("This day", record, true) +
      statPair("Streak now", streak.days ? plural(streak.days, "day") : "none", true);
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
    /* The bar gets progressbar semantics while the numbers beside it stay plain
       text: role="progressbar" on the whole block would make a screen reader read
       "Learnt so far 4 of 13" twice over. */
    return '<div class="meter-head"><span>Learnt so far</span>' +
        '<span class="meter-count"><span data-stat="meter">' +
          Marks.countLearnt() + "</span> of " + TOPICS.length + "</span></div>" +
      '<div class="meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="' + TOPICS.length +
        '" aria-valuenow="' + Marks.countLearnt() + '" aria-label="Topics marked learnt">' +
        '<span class="meter-fill" style="width:' + percentDone() + '%"></span></div>';
  }

  function cardMarkup(topic) {
    var cat = categoryOf(topic);
    /* The two marks carry their own words for a screen reader. An icon alone is
       invisible to it and a title attribute is unreliable, which would leave a
       non-visual reader on the Learnt tab unable to tell which of a hundred rows
       qualify — and the only other difference is the card's background colour. */
    return '<a class="card" href="#/topic/' + esc(topic.id) + '"' +
             ' data-topic="' + esc(topic.id) + '" data-cat="' + esc(topic.category) + '">' +
             '<span class="chip"><span class="chip-dot"></span>' + esc(cat.label) + "</span>" +
             '<h2 class="card-title">' + esc(topic.title) + "</h2>" +
             '<p class="card-excerpt">' + esc(topic.summary) + "</p>" +
             '<span class="card-foot">' +
               '<span class="source-site">' + esc(domainOf(topic.source.url)) + "</span>" +
               '<span class="marks">' +
                 '<span class="mark-learnt" hidden>' + svg("i-check") +
                   '<span class="sr-only">Learnt</span></span>' +
                 '<span class="mark-star" hidden>' + svg("i-star") +
                   '<span class="sr-only">Starred</span></span>' +
               "</span>" +
             "</span>" +
           "</a>";
  }

  /* -------------------------------------------------------------- library ---
     The index is built once and then patched. Rebuilding it on every keystroke
     would destroy the field being typed in, and rebuilding it on every mark would
     throw away the reader's place in a list that is going to be 120 rows deep.

     Two of the three facets live in the route. A tab or a field is a discrete
     tap, so each earns a history entry and a link worth keeping: #/library/
     starred/history opens exactly that view. The query stays out of the route on
     purpose — twelve keystrokes would write twelve back-steps through half-typed
     words, and since the field itself is never replaced its text survives a trip
     into a topic and back anyway. */
  var LIBRARY_TABS = [
    { id: "all",     label: "All" },
    { id: "unread",  label: "Unread" },
    { id: "learnt",  label: "Learnt" },
    { id: "starred", label: "Starred" }
  ];

  var library = {
    built: false,
    root: null,
    list: null,
    count: null,
    reset: null,
    input: null,
    clear: null,
    tab: "all",
    cat: "",
    query: "",
    painted: null,
    scroll: 0
  };

  /* A hand-typed or stale link naming a tab or field that does not exist falls
     back to the widest view rather than erroring: unlike a bad date, where there
     is nothing sensible to show, an unknown filter has an obvious default. */
  function knownTab(id) {
    for (var i = 0; i < LIBRARY_TABS.length; i += 1) {
      if (LIBRARY_TABS[i].id === id) return id;
    }
    return "all";
  }

  function knownCat(id) {
    return CATEGORY_BY_ID[id] ? id : "";
  }

  function libraryTabLabel(id) {
    for (var i = 0; i < LIBRARY_TABS.length; i += 1) {
      if (LIBRARY_TABS[i].id === id) return LIBRARY_TABS[i].label;
    }
    return "All";
  }

  function catLabel(id) {
    return CATEGORY_BY_ID[id] ? CATEGORY_BY_ID[id].label : id;
  }

  /* Both segments are positional, so a field without a tab still needs the first
     segment filled — hence the "all" placeholder. */
  function libraryRoute(tab, cat) {
    var segments = [];
    if ((tab && tab !== "all") || cat) segments.push(tab && tab !== "all" ? tab : "all");
    if (cat) segments.push(cat);
    return "#/library" + (segments.length ? "/" + segments.map(encodeURIComponent).join("/") : "");
  }

  /* Assigning a hash the page already has fires no event, so anything that
     changes state alongside the route needs to know whether a render is actually
     coming back to it. Tapping the tab already on is the common case. */
  function goToLibrary(tab, cat) {
    var target = libraryRoute(tab, cat);
    if (target === location.hash) return false;
    location.hash = target;
    return true;
  }

  /* Title, summary and field label, folded once at startup rather than on every
     keystroke — M7 puts 120 topics through this. Points and caveat are left out
     deliberately: the summary is what the reader sees on the card, so a match
     they cannot see reads as a glitch rather than a clever search. */
  var SEARCH_TEXT = {};

  function buildSearchText() {
    SEARCH_TEXT = {};
    TOPICS.forEach(function (topic) {
      SEARCH_TEXT[topic.id] = fold([
        topic.title, topic.summary, categoryOf(topic).label
      ].join(" "));
    });
  }

  /* Every token has to appear somewhere in the haystack, but not next to each
     other, so "turkey war" and "war turkey" both land on the same topic. */
  function matchesQuery(topic, tokens) {
    var text = SEARCH_TEXT[topic.id] || "";
    for (var i = 0; i < tokens.length; i += 1) {
      if (text.indexOf(tokens[i]) < 0) return false;
    }
    return true;
  }

  function filterTopics() {
    var tokens = tokensOf(library.query);

    return TOPICS.filter(function (topic) {
      if (library.cat && topic.category !== library.cat) return false;
      if (library.tab === "unread" && Marks.isLearnt(topic.id)) return false;
      if (library.tab === "learnt" && !Marks.isLearnt(topic.id)) return false;
      if (library.tab === "starred" && !Marks.isStarred(topic.id)) return false;
      return !tokens.length || matchesQuery(topic, tokens);
    });
  }

  /* What the search actually searched for, which is not always what was typed:
     a query of "…" or "d" yields no tokens and narrows nothing, so the line must
     not credit it with a search. Echoing the tokens also shows "dunning-kruger"
     as the two words it was matched on. */
  function queryEcho() {
    var tokens = tokensOf(library.query);
    return tokens.length ? tokens.join(" ") : "";
  }

  function narrowed() {
    return library.tab !== "all" || !!library.cat || !!queryEcho();
  }

  function dropQuery() {
    library.query = "";
    /* The field is the query's only home, so it has to be emptied along with the
       state or the two disagree on screen. */
    if (library.input) library.input.value = "";
  }

  function clearQuery() {
    dropQuery();
    applyLibrary();
  }

  function resetLibrary() {
    dropQuery();
    /* The route carries two of the three facets, so clearing the third is the one
       case where a patch has to be issued by hand: if the route is already at the
       bare index, no hash change is coming to do it. */
    if (!goToLibrary("all", "")) applyLibrary();
  }

  /* An empty tab and an empty search are different problems. One is a record of
     progress and needs the way onward; the other is a wording problem and needs
     the query removed. Naming the facets that produced the state, rather than
     printing a generic "no results", is what makes an empty list feel answered
     instead of broken. */
  function emptyState() {
    if (library.query) {
      return {
        title: "Nothing matches that",
        body: "No topic has those words in its title, summary or field." +
          (library.tab !== "all" || library.cat
            ? " Try widening the tab or the field." : ""),
        label: "Clear the search",
        action: "clear-search",
        href: ""
      };
    }

    if (library.tab === "starred") {
      return {
        title: "Nothing starred yet",
        body: "Open a topic and tap the star to keep it here. Starred is separate " +
          "from learnt — a topic can be both.",
        label: "Browse the index",
        action: "go",
        href: libraryRoute("all", library.cat)
      };
    }

    if (library.tab === "learnt") {
      return {
        title: "Nothing marked yet",
        body: "Mark a topic as learnt from its page, or from today's pick, and it " +
          "will collect here with the date you did it.",
        label: "Go to today",
        action: "go",
        href: "#/today"
      };
    }

    if (library.tab === "unread") {
      return {
        title: "Nothing left unread",
        body: library.cat
          ? "Every topic filed under " + catLabel(library.cat) + " is marked learnt."
          : "Every topic in the index is marked learnt.",
        label: "See what you have learnt",
        action: "go",
        href: libraryRoute("learnt", library.cat)
      };
    }

    if (library.cat) {
      return {
        title: "Nothing filed there yet",
        body: catLabel(library.cat) + " has no topics in this build.",
        label: "Show every field",
        action: "go",
        href: libraryRoute(library.tab, "")
      };
    }

    return {
      title: "The index is empty",
      body: "No topics have been added yet.",
      label: "Go to today",
      action: "go",
      href: "#/today"
    };
  }

  function emptyMarkup() {
    var state = emptyState();
    var action = state.action === "clear-search"
      ? '<button class="btn btn-quiet" type="button" data-clear-search>' + esc(state.label) + "</button>"
      : '<a class="btn btn-quiet" href="' + esc(state.href) + '">' + esc(state.label) + "</a>";

    return '<div class="empty empty-list"><h2>' + esc(state.title) + "</h2>" +
      "<p>" + esc(state.body) + "</p>" + action + "</div>";
  }

  /* Written as segments so the whole line re-reads rather than growing clauses
     that contradict each other as facets are added and removed. */
  function countMarkup(found) {
    var bits = [];
    var echo = queryEcho();
    if (echo) bits.push("“" + echo + "”");
    if (library.tab !== "all") bits.push(libraryTabLabel(library.tab));
    if (library.cat) bits.push(catLabel(library.cat));

    var lead = bits.length ? esc(bits.join(" · ")) + " — " : "";
    return lead + found.length + (found.length === TOPICS.length
      ? " topics" : " of " + TOPICS.length + " topics");
  }

  function syncLibraryControls() {
    each(library.root.querySelectorAll("[data-tab]"), function (button) {
      button.setAttribute("aria-pressed",
        button.getAttribute("data-tab") === library.tab ? "true" : "false");
    });

    each(library.root.querySelectorAll("[data-filter]"), function (chip) {
      chip.setAttribute("aria-pressed",
        knownCat(chip.getAttribute("data-filter")) === library.cat ? "true" : "false");
    });

    library.clear.hidden = !library.query;
  }

  /* Marks are painted onto the nodes from the store rather than baked into the
     card string, so a list built on first visit and a list repainted after a mark
     go through the same code and cannot drift apart. */
  function paintCard(card) {
    var id = card.getAttribute("data-topic");
    var isLearnt = Marks.isLearnt(id);
    card.setAttribute("data-learnt", isLearnt ? "true" : "false");
    card.querySelector(".mark-learnt").hidden = !isLearnt;
    card.querySelector(".mark-star").hidden = !Marks.isStarred(id);
  }

  function paintCards() {
    each(library.list.querySelectorAll(".card"), paintCard);
  }

  /* The list is always rewritten whole. On the All tab a mark cannot change which
     topics are present, so this is the one case where the swap is not strictly
     necessary — but keeping a single path is worth more than skipping a pass over
     120 anchors, because two paths is where a stale card gets left behind.

     Everything the index shows is repainted here, including the progress meter,
     so no second function has to remember to follow up. */
  function applyLibrary() {
    if (!library.built) return;

    var signature = [Marks.revision(), library.tab, library.cat, library.query].join("|");
    if (signature === library.painted) return;
    library.painted = signature;

    syncLibraryControls();

    var found = filterTopics();
    library.list.innerHTML = found.length
      ? found.map(cardMarkup).join("")
      : emptyMarkup();
    paintCards();

    library.count.innerHTML = countMarkup(found);
    library.reset.hidden = !narrowed();

    /* The meter is part of the skeleton rather than the list, so its own nodes are
       written instead of being rebuilt with the rest — the bar animates from the
       old width, which is the point of showing it. */
    var count = Marks.countLearnt();
    library.root.querySelector('[data-stat="meter"]').textContent = count;

    var track = library.root.querySelector(".meter-track");
    track.setAttribute("aria-valuenow", count);
    track.setAttribute("aria-valuetext", count + " of " + TOPICS.length + " marked learnt");
    library.root.querySelector(".meter-fill").style.width = percentDone() + "%";
  }

  function buildLibrary() {
    var filters = ['<button class="chip" type="button" data-filter="" aria-pressed="true">All fields</button>']
      .concat(CATEGORIES.map(function (cat) {
        return '<button class="chip" type="button" data-filter="' + esc(cat.id) + '" data-cat="' +
                 esc(cat.id) + '" aria-pressed="false"><span class="chip-dot"></span>' +
                 esc(cat.label) + "</button>";
      })).join("");

    var tabs = LIBRARY_TABS.map(function (tab) {
      return '<button class="tab-btn" type="button" data-tab="' + tab.id +
               '" aria-pressed="' + (tab.id === "all" ? "true" : "false") + '">' +
               tab.label + "</button>";
    }).join("");

    /* The clear button sits outside the label on purpose: a label may not contain
       another control, and a button inside one steals the tap by focusing the
       field instead of clearing it. */
    document.getElementById("screen-library").innerHTML =
      '<div class="library">' +
        '<header><h1 class="eyebrow" id="library-h"><span class="eyebrow-mark"></span>The index</h1></header>' +
        '<div class="meter">' + meterMarkup() + "</div>" +
        '<div class="field">' +
          '<label class="field-label">' +
            "<span>" + svg("i-search") + "</span>" +
            '<input type="search" placeholder="Search titles, summaries and fields" ' +
              'aria-label="Search topics" autocomplete="off" spellcheck="false">' +
          "</label>" +
          '<button class="field-clear" type="button" aria-label="Clear search" title="Clear search" hidden>' +
            svg("i-close") + "</button>" +
        "</div>" +
        '<div class="tabs" role="group" aria-label="Filter by status">' + tabs + "</div>" +
        '<div class="filters" role="group" aria-label="Filter by field">' + filters + "</div>" +
        '<p class="list-count"><span class="list-count-text" aria-live="polite"></span>' +
          '<button class="link-btn" type="button" data-reset hidden>Clear filters</button></p>' +
        '<div class="list" id="library-list"></div>' +
      "</div>";

    library.root = document.querySelector("#screen-library .library");
    library.list = document.getElementById("library-list");
    library.count = library.root.querySelector(".list-count-text");
    library.reset = library.root.querySelector("[data-reset]");
    library.input = library.root.querySelector("input");
    library.clear = library.root.querySelector(".field-clear");
    library.built = true;

    /* Typing only ever patches the list, so the field keeps focus and the caret
       keeps its place. Neither action nor search moves the window — a filter tap
       does, but that happens through the route in render(). */
    library.input.addEventListener("input", function () {
      library.query = library.input.value.trim();
      applyLibrary();
    });

    /* Esc is a key, not a shortcut: it is the one way to get out of a search field
       on a physical keyboard, and it only ever cancels the query. */
    library.input.addEventListener("keydown", function (event) {
      if ((event.key || "").toLowerCase() === "escape" && library.query) clearQuery();
    });

    library.clear.addEventListener("click", clearQuery);

    /* Bound to the skeleton rather than the document: the shuffle screen carries a
       second row of field chips, and a handler on the document would answer taps on
       either of them. */
    library.root.addEventListener("click", function (event) {
      if (!event.target.closest) return;

      var clear = event.target.closest("[data-clear-search]");
      if (clear) { clearQuery(); return; }

      var reset = event.target.closest("[data-reset]");
      if (reset) { resetLibrary(); return; }

      var tab = event.target.closest("[data-tab]");
      if (tab) { goToLibrary(tab.getAttribute("data-tab"), library.cat); return; }

      var chip = event.target.closest("[data-filter]");
      if (chip) goToLibrary(library.tab, knownCat(chip.getAttribute("data-filter")));
    });
  }

  /* ------------------------------------------------------------- shuffle ---
     The daily pick is deliberately the same for everybody on a given date, so it
     reads as an appointment rather than a slot machine. This screen is the
     opposite: a roll has no right answer, so randomness is the point here.

     Random by drawing, though, not by picking. Choosing one of thirteen topics at
     random repeats a card often enough to look broken — the same failure the
     date-hashed daily pick had. So the roll works through a shuffled stack: every
     topic in play is dealt once before the stack turns over, and a new stack opens
     on something other than the card already on the screen by trading it with the
     card behind it, which keeps both rules without costing a topic its turn.

     The stack lives in memory only. It is a queue for one sitting, not a record of
     anything, which is why marks and day pins stay the app's only persistent state
     and no third storage key is needed. */
  var shuffle = {
    built: false,
    root: null,
    stage: null,
    row: null,
    rollBtn: null,
    label: null,
    count: null,
    status: null,
    cat: "",
    order: [],
    shown: null,
    /* idle = nothing dealt yet, rolled = a card is on the stage,
       empty = the field has nothing left to deal. */
    mode: "idle",
    learntToo: false,   /* the fallback, reached only from the empty state */
    handBack: false     /* a link inside the stage was followed; focus comes back */
  };

  function shuffleRoute(cat) {
    return "#/shuffle" + (cat ? "/" + encodeURIComponent(cat) : "");
  }

  /* Same contract as goToLibrary: tells the caller whether a render is coming. */
  function goToShuffle(cat) {
    var target = shuffleRoute(cat);
    if (target === location.hash) return false;
    location.hash = target;
    return true;
  }

  function shuffleScope() {
    return shuffle.cat ? catLabel(shuffle.cat) : "every field";
  }

  /* What a roll is allowed to hand over: the field in play, minus what the reader
     has already marked — unless the fallback was accepted, which puts the marked
     ones back in. */
  function shufflePool() {
    var ids = [];
    TOPICS.forEach(function (topic) {
      if (shuffle.cat && topic.category !== shuffle.cat) return;
      if (shuffle.learntToo || !Marks.isLearnt(topic.id)) ids.push(topic.id);
    });
    return ids;
  }

  /* False when a card has been marked, or has left the content, since the stack
     was dealt. Skipping it costs one card from the current run rather than
     breaking it: the rest of the stack is still each topic once. */
  function stillInPlay(id) {
    return !!TOPIC_BY_ID[id] && (shuffle.learntToo || !Marks.isLearnt(id));
  }

  function openShuffleDeck() {
    var pool = shufflePool();
    if (!pool.length) return;

    var order = permutationOf(pool.length, (Math.random() * 0x100000000) >>> 0);
    var deck = order.map(function (index) { return pool[index]; });

    /* The stack must not open on the card still sitting on the screen. That card is
       traded with the one behind it rather than dropped, so a stack still holds each
       topic exactly once: dropping it would leave one topic short every stack it
       happens to have ended, and over a long run that topic falls visibly behind the
       rest — the same mistake, found the same way, that the daily picker made before
       a swap replaced its substitution. With two topics in play the trade is between
       the only two there are; with one there is nothing to trade, and the alternative
       to showing it is showing nothing. */
    if (deck.length > 1 && deck[0] === shuffle.shown) {
      deck[0] = deck[1];
      deck[1] = shuffle.shown;
    }

    shuffle.order = deck;
  }

  function drawNext() {
    /* Two passes rather than recursion: the first can drain the stack entirely on
       cards marked since it was dealt, which earns one reshuffle before the roll
       gives up. Either way this returns or falls out, so a scope emptied by marks
       cannot spin. */
    for (var pass = 0; pass < 2; pass += 1) {
      if (!shuffle.order.length) {
        openShuffleDeck();
        if (!shuffle.order.length) return null;
      }
      while (shuffle.order.length) {
        var id = shuffle.order.shift();
        if (stillInPlay(id)) return id;
      }
    }
    return null;
  }

  /* A blank stack with the shuffle glyph on its face: nothing dealt yet. It is
     decoration beside a labelled button, so the whole of it stays out of the
     reading order rather than presenting cards a reader cannot open. */
  function restingStage() {
    return '<div class="deck" aria-hidden="true">' +
        '<div class="deck-card" data-depth="2"></div>' +
        '<div class="deck-card" data-depth="1"></div>' +
        '<div class="deck-card" data-depth="0">' + svg("i-shuffle") + "</div>" +
      "</div>";
  }

  /* The index's own card, reused whole: a rolled topic must not look like a
     different kind of thing from the same topic in the library, and its marks are
     then painted by the same function as every other row. The two cards behind it
     are drawn in CSS, which keeps the stack from needing a height of its own. */
  function rolledStage(topic) {
    return '<div class="roll-stack">' + cardMarkup(topic) + "</div>";
  }

  /* The fallback says what ran out and offers the two ways past it, which is how
     every other empty state in the app works. Widening is a link because it
     changes the address; rolling through marked topics is not, because it is a
     one-off concession the address should not pretend to remember. */
  function exhaustedStage() {
    var filed = 0;
    TOPICS.forEach(function (topic) {
      if (!shuffle.cat || topic.category === shuffle.cat) filed += 1;
    });

    /* A field runs out two different ways, and only one of them is about marks.
       An empty field is the state M7 leaves a category in until it is written, and
       there telling the reader every topic in it is marked learnt would be a
       falsehood — as would offering to roll through the marked ones, which has
       nothing to roll. Only a chosen field can be empty this way: an index with no
       topics at all is a different failure, and says so above. */
    if (shuffle.cat && !filed) {
      return '<div class="empty"><h2>Nothing filed there yet</h2>' +
        "<p>" + esc(catLabel(shuffle.cat)) + " has no topics in this build, so there " +
        "is nothing for the roll to hand over.</p>" +
        '<a class="btn btn-quiet" href="' + esc(shuffleRoute("")) + '" data-widen>' +
        "Roll from every field</a></div>";
    }

    var actions = '<button class="btn btn-quiet" type="button" data-include-learnt>' +
      "Roll through the marked ones</button>";
    if (shuffle.cat) {
      actions += '<a class="btn btn-quiet" href="' + esc(shuffleRoute("")) + '" data-widen>' +
        "Roll from every field</a>";
    }

    /* The field is named where naming it is the answer; with every field out of
       topics there is no wider view to point at, and only one action left. */
    return '<div class="empty"><h2>' +
        (shuffle.cat ? "Nothing left in " + catLabel(shuffle.cat) : "Nothing left to roll") +
      "</h2><p>Every topic " + (shuffle.cat ? "filed there" : "in the index") +
      " is marked learnt, so there is nothing for the roll to hand over.</p>" +
      actions + "</div>";
  }

  /* Rewritten whole, because the card that lands is a new node and a new node is
     what plays the reveal. Whatever held focus inside it before is handed to
     something by rollShuffle and renderShuffle, since this is the one place in the
     app a control destroys itself. */
  function paintStage() {
    var topic = TOPIC_BY_ID[shuffle.shown];
    var rolled = shuffle.mode === "rolled" && topic;

    shuffle.stage.setAttribute("data-state", rolled ? "rolled" : shuffle.mode);
    shuffle.stage.innerHTML = rolled
      ? rolledStage(topic)
      : shuffle.mode === "empty" ? exhaustedStage() : restingStage();
  }

  function shuffleCaptionText() {
    var pool = shufflePool();
    var bits = [];

    if (shuffle.learntToo) {
      /* Counting these as unmarked would be a lie — the fallback was reached
         because there are none. */
      bits.push(pool.length + (pool.length === 1 ? " topic" : " topics") + " in play");
      bits.push("marked ones included");
    } else {
      bits.push(pool.length
        ? pool.length + (pool.length === 1 ? " topic unmarked" : " topics unmarked")
        : "nothing unmarked");
      if (shuffle.order.length) {
        bits.push(shuffle.order.length +
          (shuffle.order.length === 1 ? " card" : " cards") + " before the stack turns");
      }
    }

    return (shuffle.cat ? catLabel(shuffle.cat) : "Every field") + " — " + bits.join(" · ");
  }

  function syncShuffle() {
    if (!shuffle.built) return;

    each(shuffle.root.querySelectorAll("[data-filter]"), function (chip) {
      chip.setAttribute("aria-pressed",
        knownCat(chip.getAttribute("data-filter")) === shuffle.cat ? "true" : "false");
    });

    shuffle.label.textContent = "Roll from " + shuffleScope();
    /* The control disappears with nothing to roll; the empty state that replaces it
       carries the two actions that are still possible. Leaving a button that does
       nothing on every tap would be the worse of the two. */
    shuffle.row.hidden = shuffle.mode === "empty";
    shuffle.count.textContent = shuffleCaptionText();

    /* Patched rather than repainted: rebuilding the card here would replay its
       entrance animation on every mark, which is the defect M2 was fixed for. */
    var card = shuffle.stage.querySelector(".card");
    if (card) paintCard(card);
  }

  /* A new field is a new question, so the card and the stack are dropped with it.
     The last thing shown is kept for the deck alone: it still must not be the
     first card out of the new stack. */
  function resetShuffle(cat) {
    shuffle.cat = cat;
    shuffle.order.length = 0;
    shuffle.learntToo = false;
    shuffle.mode = "idle";
    paintStage();
  }

  /* Focus goes to whatever the roll put where the control that caused it used to
     be. Only the message needs help to take it: it is a div, and a negative
     tabindex lets it be focused without adding a stop to the tab order the card it
     sits beside already has. */
  function focusStage(target) {
    if (!target) return;
    if (target.tagName === "DIV" && !target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
  }

  function rollShuffle() {
    /* The button under the stage is not destroyed by a roll and keeps focus, so a
       reader can fire it again. A control inside the stage is destroyed by the roll
       it triggers, and hiding the button when the stack runs out strands its focus
       too — both hand it to what replaced them rather than to the body. */
    var heldByStage = shuffle.stage.contains(document.activeElement);

    var id = drawNext();
    var topic = id ? TOPIC_BY_ID[id] : null;

    if (topic) shuffle.shown = id;
    shuffle.mode = topic ? "rolled" : "empty";
    paintStage();
    syncShuffle();

    if (!topic) {
      focusStage(shuffle.stage.querySelector(".empty"));
      return;
    }

    if (heldByStage) focusStage(shuffle.stage.querySelector(".card"));

    /* Spoken rather than shown: the tapped button keeps focus, so the card that
       lands after it would otherwise go unnoticed. A status region, not a heading —
       the visible caption below is deliberately not live, or every roll would be
       read out twice. */
    shuffle.status.textContent = topic.title + " — " + catLabel(topic.category);
  }

  function buildShuffle() {
    var filters = ['<button class="chip" type="button" data-filter="" aria-pressed="true">All fields</button>']
      .concat(CATEGORIES.map(function (cat) {
        return '<button class="chip" type="button" data-filter="' + esc(cat.id) + '" data-cat="' +
                 esc(cat.id) + '" aria-pressed="false"><span class="chip-dot"></span>' +
                 esc(cat.label) + "</button>";
      })).join("");

    document.getElementById("screen-shuffle").innerHTML =
      '<div class="shuffle">' +
        '<header><h1 class="eyebrow" id="shuffle-h"><span class="eyebrow-mark"></span>Surprise me</h1>' +
          '<h2 class="lede">A topic you have not marked yet, from one field or from all ' +
          "of them. Nothing comes up twice until the stack has run out.</h2></header>" +
        '<div class="filters" role="group" aria-label="Choose a field to roll from">' +
          filters + "</div>" +
        '<div class="stage" data-state="idle"></div>' +
        '<div class="roll-row">' +
          '<button class="btn btn-primary" type="button" data-roll>' +
            svg("i-shuffle") + "<span></span></button>" +
        "</div>" +
        '<p class="list-count"><span class="list-count-text"></span>' +
          '<span class="sr-only" role="status"></span></p>' +
      "</div>";

    shuffle.root = document.querySelector("#screen-shuffle .shuffle");
    shuffle.stage = shuffle.root.querySelector(".stage");
    shuffle.row = shuffle.root.querySelector(".roll-row");
    shuffle.rollBtn = shuffle.root.querySelector("[data-roll]");
    shuffle.label = shuffle.root.querySelector("[data-roll] span");
    shuffle.count = shuffle.root.querySelector(".list-count-text");
    shuffle.status = shuffle.root.querySelector('[role="status"]');
    shuffle.built = true;

    paintStage();

    /* Bound to this screen's own root, as the index's controls are to theirs, so
       the two rows of field chips cannot answer each other's taps. */
    shuffle.root.addEventListener("click", function (event) {
      if (!event.target.closest) return;

      var chip = event.target.closest("[data-filter]");
      if (chip) { goToShuffle(knownCat(chip.getAttribute("data-filter"))); return; }

      if (event.target.closest("[data-roll]")) { rollShuffle(); return; }

      if (event.target.closest("[data-include-learnt]")) {
        shuffle.learntToo = true;
        rollShuffle();
        return;
      }

      /* Left as a link rather than intercepted, so it can be opened anywhere a link
         can. It sits inside the stage, so this tap destroys it: the flag below is
         how focus gets home when the new view is drawn. */
      if (event.target.closest("a[data-widen]")) shuffle.handBack = true;
    });
  }

  function renderShuffle(cat) {
    var field = knownCat(cat);
    if (!shuffle.built) buildShuffle();
    /* Tapping the field already chosen changes no address, so no render follows it
       and the card on the stage stays. Only a genuine change of field clears it. */
    if (field !== shuffle.cat) resetShuffle(field);
    syncShuffle();

    if (shuffle.handBack) {
      shuffle.handBack = false;
      focusStage(shuffle.rollBtn);
    }
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
      '<div class="day"><div class="empty"><h1 id="day-h">No such day</h1>' +
        "<p>A date has to read as year-month-day, and it has to be one that exists — " +
        "14 January 2026 does, 2026-02-30 does not.</p>" +
        '<p><a class="btn btn-quiet" href="#/today">Go to today</a></p></div></div>';
  }

  /* The route supplies the tab and the field. The query is deliberately not read
     from here: it lives in a field that outlives the route change, so coming back
     from a topic keeps what was typed without a URL having to carry it. */
  function renderLibrary(tab, cat) {
    library.tab = knownTab(tab);
    library.cat = knownCat(cat);
    if (!library.built) buildLibrary();
    applyLibrary();
  }

  function renderTopic(id) {
    var screen = document.getElementById("screen-topic");
    var topic = TOPIC_BY_ID[id];

    if (!topic) {
      screen.innerHTML = '<div class="empty"><h1 id="topic-h">No such topic</h1>' +
        "<p>That link points somewhere not in this index.</p>" +
        '<p><a class="btn btn-quiet" href="#/library">Back to the index</a></p></div>';
      return;
    }
    screen.innerHTML = topicMarkup(topic, {
      /* Back to the index as the index was left — a reader who opened this from
         Learnt-in-History should land there, not on all 120. On a cold load
         straight into a topic the state is still the default view. */
      titleId: "topic-h",
      back: libraryRoute(library.tab, library.cat)
    });
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

    /* The index is repainted from the store rather than patched card by card. It
       owns its own marks, its count and its bar, and a mark can move a topic
       between tabs — so it goes through the same path a filter change uses, which
       is the only way an empty tab learns it has just become empty. */
    applyLibrary();

    /* The shuffle keeps its card and only updates the numbers around it: a topic
       marked after being rolled has to leave the stack's pool, and the card on the
       stage has to show that it is marked. */
    syncShuffle();

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

    if (parts[0] === "topic" && parts[1]) return { screen: "topic", id: decodeBit(parts[1]) };
    if (parts[0] === "library") {
      /* #/library/<tab>/<field> — both segments optional. An unknown one falls
         back to the widest view rather than erroring, so a mistyped link shows
         everything instead of nothing. */
      return {
        screen: "library",
        tab: knownTab(decodeBit(parts[1])),
        cat: knownCat(decodeBit(parts[2]))
      };
    }

    if (parts[0] === "shuffle") {
      /* #/shuffle/<field> — one optional segment, the field to roll within. As with
         the index, an unknown field falls back to every field rather than erroring.
         What came up is deliberately not in the address: a roll is not repeatable,
         so a bookmark of the result would be a promise this screen cannot keep. */
      return { screen: "shuffle", cat: knownCat(decodeBit(parts[1])) };
    }

    if (parts[0] === "day" && parts[1]) {
      var iso = decodeBit(parts[1]);
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

  var currentScreen = "";

  function render(options) {
    var opts = options || {};
    var route = parseRoute();
    var entering = route.screen !== currentScreen;

    /* Leaving the index: remember where the reader stood. The list is not torn down
       between visits, so a trip into a topic and back should return them to the
       same row rather than to the top of a hundred. Saved at the moment of leaving
       rather than at each filter change, because that is the only position worth
       restoring. */
    if (currentScreen === "library" && route.screen !== "library" && library.built) {
      library.scroll = window.scrollY || 0;
    }

    if (route.screen === "day") {
      if (route.bad) renderBadDay();
      else renderDay(route.iso);
    }
    if (route.screen === "library") renderLibrary(route.tab, route.cat);
    if (route.screen === "shuffle") renderShuffle(route.cat);
    if (route.screen === "topic") renderTopic(route.id);

    show(route.screen);
    syncMarks();
    currentScreen = route.screen;

    var dateNode = document.getElementById("masthead-date");
    if (dateNode) dateNode.textContent = shortDate(new Date());

    var topic = route.screen === "topic" ? TOPIC_BY_ID[route.id] : null;
    document.title = (topic ? topic.title + " — " : "") + "daily-learn";

    /* Entering the index from somewhere else puts the reader back where they were;
       every other change — including tapping a tab or a field, which redraws the
       whole list — starts at the top. */
    var place = route.screen === "library" && entering ? library.scroll : 0;
    window.scrollTo({ top: place, behavior: "auto" });

    /* Only when the screen actually changed. Tapping a tab or a field is also a
       route change, but nothing was destroyed — the skeleton is still there and
       the tapped control is still under the finger. Moving focus then would drop
       a keyboard or screen-reader user back at the heading, to tab all the way
       through the toolbar again for the next filter. */
    if (opts.navigate && entering) moveFocus(route.screen);
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
    buildSearchText();
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
