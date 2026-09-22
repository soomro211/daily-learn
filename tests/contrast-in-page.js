/* Contrast audit — a measuring instrument, not part of the app.

   Load it into the running page and it exposes window.audit(label) for every
   state worth checking. Nothing here is referenced by index.html; the app has no
   test runner, no build step and no dependencies.

   Usage, in the in-app browser via evaluate_script:

     var t = document.createElement('script');
     t.src = 'tests/contrast-in-page.js';
     document.head.appendChild(t);            // then, once it has loaded:
     await window.contrastAudit.runAll();     // every state, both themes

   Three traps this file exists to avoid, all of them encountered in practice:

   1. Only the ACTIVE screen can be measured. A hidden screen's colours resolve
      against nothing, which reports as a wall of failures that mean nothing.
   2. CSS animations do not tick in a document the browser is not painting — which
      is what an unread browser panel is. A screen entered moments ago can sit
      frozen at the first keyframe, at opacity 0, indefinitely. So every node's
      accumulated opacity is composited, and a node measured at opacity 0 is
      reported separately as "not painted" rather than counted as a failure.
   3. Alpha has to be composited through. A tab bar at 88% over the page is not the
      colour its computed style claims, and a translucent button on a tinted card
      can converge on the page colour behind it. */

(function () {
  "use strict";

  function parse(color) {
    var match = /rgba?\(([^)]+)\)/.exec(color);
    if (!match) return null;
    var parts = match[1].split(",").map(function (bit) { return parseFloat(bit); });
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function over(fg, bg) {
    var a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a: a
    };
  }

  function luminance(c) {
    var v = [c.r, c.g, c.b].map(function (channel) {
      var x = channel / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }

  function ratio(a, b) {
    var l1 = luminance(a);
    var l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /* The stacked, possibly translucent grounds between a node and the page. */
  function ground(node) {
    var layers = [];
    var current = node;
    while (current && current.nodeType === 1) {
      var bg = parse(getComputedStyle(current).backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
      current = current.parentElement;
    }
    if (layers.length) return layers.reduce(function (bottom, top) { return over(top, bottom); });
    return parse(getComputedStyle(document.documentElement).backgroundColor) ||
      { r: 255, g: 255, b: 255, a: 1 };
  }

  function accumulatedOpacity(node) {
    var total = 1;
    var current = node;
    while (current && current.nodeType === 1) {
      total *= parseFloat(getComputedStyle(current).opacity);
      current = current.parentElement;
    }
    return total;
  }

  /* The composited contrast of one node's own text against everything painted
     behind it. Exposed on its own so a single value can be swept while tuning. */
  function contrastOf(node) {
    var style = getComputedStyle(node);
    var fg = parse(style.color);
    if (!fg) return null;
    var bg = ground(node);
    var ink = over({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * accumulatedOpacity(node) }, bg);
    return { ratio: ratio(ink, bg), background: bg, foreground: ink };
  }

  /* One pass over the text that is on screen right now. */
  function measure() {
    var failures = [];
    var unpainted = 0;
    var checked = 0;
    var tightest = {};

    Array.prototype.forEach.call(document.querySelectorAll("body *"), function (node) {
      if (node.closest("[hidden]")) return;
      if (node.closest(".screen:not([data-active])")) return;
      if (node.closest('[aria-hidden="true"]')) return;

      var text = "";
      Array.prototype.forEach.call(node.childNodes, function (child) {
        if (child.nodeType === 3) text += child.textContent;
      });
      if (!text.trim()) return;

      var style = getComputedStyle(node);
      var size = parseFloat(style.fontSize);
      var weight = parseInt(style.fontWeight, 10) || 400;

      /* WCAG's large-text allowance: 3:1 rather than 4.5:1. */
      var large = size >= 24 || (size >= 18.66 && weight >= 700);
      var need = large ? 3 : 4.5;

      var opacity = accumulatedOpacity(node);
      if (opacity < 0.01) {
        unpainted += 1;
        return;
      }

      var measured = contrastOf(node);
      if (!measured) return;
      var score = measured.ratio;

      checked += 1;
      var key = node.tagName.toLowerCase() + "." + (node.className || "").toString().split(" ")[0];
      if (!tightest[key] || score < tightest[key].ratio) {
        tightest[key] = { ratio: +score.toFixed(2), example: text.trim().slice(0, 30) };
      }

      if (score < need - 0.01) {
        failures.push({
          ratio: +score.toFixed(2), need: need, px: +size.toFixed(1), weight: weight,
          where: key, text: text.trim().slice(0, 44),
          inactive: !!node.closest('[aria-disabled="true"], [disabled]')
        });
      }
    });

    return {
      theme: document.documentElement.getAttribute("data-theme"),
      hash: location.hash,
      checked: checked,
      unpainted: unpainted,
      failures: failures.length,
      detail: failures.slice(0, 20),
      tightest: Object.keys(tightest).map(function (k) {
        return { element: k, ratio: tightest[k].ratio, example: tightest[k].example };
      }).sort(function (a, b) { return a.ratio - b.ratio; }).slice(0, 10)
    };
  }

  /* Wait for the entrance to finish, or refuse to measure. */
  function settle(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function check() {
        var active = document.querySelector('.screen[data-active="true"]');
        if (!active || parseFloat(getComputedStyle(active).opacity) >= 0.999) return resolve();
        if (Date.now() - started > (timeoutMs || 1200)) {
          return reject(new Error("the active screen never reached opacity 1 — it is frozen " +
            "mid-animation because the browser is not painting this page. Open the browser " +
            "panel, or read unpainted counts instead of failure counts."));
        }
        setTimeout(check, 30);
      })();
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function library() {
    return document.getElementById("screen-library");
  }

  function typeQuery(text) {
    var input = library().querySelector("input");
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* Seed through the store's own API by tapping, so the marks carry real dates and
     the streak stays honest. A state that needs a marked topic has to be able to
     mark one, which is why this sits out here rather than inside the run. */
  function markThrough(id, action) {
    location.hash = "#/topic/" + id;
    return wait(180).then(function () {
      var active = document.querySelector('.screen[data-active="true"]');
      if (!active || parseFloat(getComputedStyle(active).opacity) < 0.999) return;
      var button = document.querySelector('#screen-topic [data-act="' + action + '"]');
      if (button && button.getAttribute("aria-pressed") !== "true") button.click();
    });
  }

  /* Every state the index can be in, plus every screen. Each row is one measure.
     Marks are set through the real buttons rather than written into storage, so a
     broken store would show up here as a broken state. */
  var STATES = [
    { label: "index, all", go: function () { location.hash = "#/library"; } },
    { label: "index, unread tab + field", go: function () { location.hash = "#/library/unread/history"; } },
    { label: "index, field + learnt tab", go: function () { location.hash = "#/library/learnt/philosophy"; } },
    { label: "index, query narrowing", go: function () {
      location.hash = "#/library";
      return wait(160).then(function () { typeQuery("sky"); });
    } },
    { label: "index, no matches", go: function () {
      return wait(60).then(function () { typeQuery("qqqqx"); });
    } },
    { label: "index, starred empty", go: function () { location.hash = "#/library/starred"; } },
    { label: "index, learnt populated", go: function () { location.hash = "#/library/learnt"; } },
    { label: "topic", go: function () { location.hash = "#/topic/turkish-war"; } },
    { label: "topic, no such topic", go: function () { location.hash = "#/topic/not-a-topic"; } },
    { label: "day, today", go: function () { location.hash = "#/today"; } },
    { label: "day, past with week strip", go: function () { location.hash = "#/day/2026-09-19"; } },
    { label: "day, invalid", go: function () { location.hash = "#/day/2026-02-30"; } },
    { label: "shuffle, nothing dealt", go: function () { location.hash = "#/shuffle"; } },
    { label: "shuffle, a card dealt", go: function () {
      return wait(60).then(function () {
        var button = document.querySelector("#screen-shuffle [data-roll]");
        if (button) button.click();
      });
    } },
    { label: "shuffle, field run out", go: function () {
      /* The only way to reach the fallback is to mark a field's topics through their
         own buttons and then roll, so this does exactly that. Three of the sample
         fields hold one topic each, which makes it a short honest route. */
      return markThrough("shipping-container", "learnt").then(function () {
        location.hash = "#/shuffle/engineering";
        return wait(160);
      }).then(function () {
        var button = document.querySelector("#screen-shuffle [data-roll]");
        if (button) button.click();
      });
    } }
  ];

  function runAll() {
    /* Entrance animations move opacity and transform only — no colour — but they
       never advance in a page the browser is not painting, which would leave a
       freshly entered screen at opacity 0 and every measurement meaningless. So they
       are switched off for the audit. Written as a rule rather than applied to the
       nodes found at this moment, because the rolled card is built later, by the
       state above that taps the roll. */
    var still = document.createElement("style");
    still.textContent = ".screen, .screen * { animation: none !important; }";
    document.head.appendChild(still);

    var marks = ["dunning-kruger", "occams-razor", "turkish-war"];
    var stars = ["turkish-war", "sky-is-blue"];

    var chain = Promise.resolve();
    marks.forEach(function (id) { chain = chain.then(function () { return markThrough(id, "learnt"); }); });
    stars.forEach(function (id) { chain = chain.then(function () { return markThrough(id, "star"); }); });

    var rows = [];
    chain = chain.then(function () {
      return STATES.reduce(function (previous, state) {
        return previous.then(function () {
          return Promise.resolve(state.go()).then(function () { return wait(200); });
        }).then(settle).then(function () {
          var row = measure();
          row.state = state.label;
          rows.push(row);
        }).catch(function (error) {
          rows.push({ state: state.label, error: String(error.message || error) });
        });
      }, Promise.resolve());
    });

    return chain.then(function () {
      var all = [];
      rows.forEach(function (r) { all = all.concat(r.detail || []); });

      /* WCAG 1.4.3 exempts inactive interface components, so the days that have
         not arrived are reported apart rather than counted as failures. Held apart
         is not the same as ignored: the number below is what a reader actually gets,
         and it should clear the 3:1 bar applied to non-text content. */
      var inactive = all.filter(function (f) { return f.inactive; });
      var real = all.filter(function (f) { return !f.inactive; });

      var checked = rows.reduce(function (n, r) { return n + (r.checked || 0); }, 0);
      var worst = {};
      rows.forEach(function (r) {
        (r.tightest || []).forEach(function (t) {
          if (!worst[t.element] || t.ratio < worst[t.element].ratio) {
            worst[t.element] = { ratio: t.ratio, example: t.example, state: r.state };
          }
        });
      });
      return JSON.stringify({
        theme: document.documentElement.getAttribute("data-theme"),
        states: rows.length,
        nodesChecked: checked,
        failures: real.length,
        detail: real.slice(0, 20),
        inactiveBelowAAText: inactive.length,
        lowestInactive: inactive.length ? Math.min.apply(null, inactive.map(function (f) { return f.ratio; })) : null,
        errors: rows.filter(function (r) { return r.error; }).map(function (r) {
          return { state: r.state, error: r.error };
        }),
        tightestAcrossAll: Object.keys(worst).map(function (k) {
          return { element: k, ratio: worst[k].ratio, example: worst[k].example, state: worst[k].state };
        }).sort(function (a, b) { return a.ratio - b.ratio; }).slice(0, 14)
      }, null, 1);
    });
  }

  window.contrastAudit = { measure: measure, runAll: runAll, settle: settle, typeQuery: typeQuery, ratioOf: contrastOf };
})();
