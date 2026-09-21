/* Logic check for the parts of the index that need no DOM.

   The functions are read straight out of js/app.js rather than copied, so this
   tests the code that ships. Anything that fails here is a real defect, not a
   difference between two versions of the same idea.

   Run with: node tests/search-logic.js */

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var source = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");

/* Pull one top-level function out of the source by counting braces. */
function grab(name) {
  var start = source.indexOf("  function " + name + "(");
  if (start < 0) throw new Error("cannot find " + name);
  var depth = 0;
  for (var i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced " + name);
}

/* And the one array the tab helpers close over, so the test runs against the
   tabs the app actually ships rather than a copy that could drift. */
function grabArray(name) {
  var start = source.indexOf("var " + name + " = [");
  if (start < 0) throw new Error("cannot find " + name);
  var end = source.indexOf("];", start);
  return source.slice(start, end + 2);
}

/* The data file only assigns to window.*, so a global stub is enough to load it. */
global.window = {};
require(path.join(root, "data", "topics.js"));

var TOPICS = global.window.DL_TOPICS;
var CATEGORIES = global.window.DL_CATEGORIES;
var CATEGORY_BY_ID = {};
CATEGORIES.forEach(function (c) { CATEGORY_BY_ID[c.id] = c; });
var TOPIC_BY_ID = {};
TOPICS.forEach(function (t) { TOPIC_BY_ID[t.id] = t; });

function categoryOf(topic) {
  return CATEGORY_BY_ID[topic.category] || { id: topic.category, label: topic.category };
}

/* The shipped implementations, evaluated in this scope so they close over the
   data above exactly as they do over the app's. */
eval(grabArray("LIBRARY_TABS"));
eval(grab("fold"));
eval(grab("tokensOf"));
eval(grab("knownTab"));
eval(grab("knownCat"));
eval(grab("catLabel"));
eval(grab("libraryRoute"));

var MARKS = { learnt: {}, starred: {} };
var Marks = {
  isLearnt: function (id) { return !!MARKS.learnt[id]; },
  isStarred: function (id) { return !!MARKS.starred[id]; }
};
var library = { tab: "all", cat: "", query: "" };
var SEARCH_TEXT = {};
eval(grab("matchesQuery"));
eval(grab("filterTopics"));

TOPICS.forEach(function (topic) {
  SEARCH_TEXT[topic.id] = fold([topic.title, topic.summary, categoryOf(topic).label].join(" "));
});

/* ------------------------------------------------------------ assertions --- */
var failures = 0;
var checks = 0;

function is(label, actual, expected) {
  checks += 1;
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log("  FAIL  " + label + "\n          got " + JSON.stringify(actual) +
                "\n          want " + JSON.stringify(expected));
  }
}

function includesAll(label, actual, expected) {
  checks += 1;
  var missing = expected.filter(function (id) { return actual.indexOf(id) < 0; });
  if (missing.length) {
    failures += 1;
    console.log("  FAIL  " + label + "\n          missing " + missing.join(", "));
  }
}

/* Folding and tokenising */
is("fold lowercases", fold("Dunning–Kruger"), "dunning–kruger");
is("fold drops accents", fold("Atatürk"), "ataturk");
is("fold keeps the letters around them", fold("Ş Schrödinger’s"), "s schrodinger\u2019s");

var normalize = String.prototype.normalize;
delete String.prototype.normalize;
is("fold degrades to lowercase without normalize", fold("Éclair"), "éclair");
String.prototype.normalize = normalize;

is("tokens split on a dash", tokensOf("dunning-kruger"), ["dunning", "kruger"]);
is("tokens split on an apostrophe", tokensOf("Murphy's law"), ["murphy", "law"]);
is("pure punctuation yields no tokens", tokensOf("— – ... !!!"), []);
is("digits are kept", tokensOf("30 years' war"), ["30", "years", "war"]);

/* Route shape */
is("default route", libraryRoute("all", ""), "#/library");
is("tab only", libraryRoute("learnt", ""), "#/library/learnt");
is("field needs the placeholder", libraryRoute("all", "history"), "#/library/all/history");
is("both", libraryRoute("starred", "physics"), "#/library/starred/physics");
is("unknown tab falls back", knownTab("nope"), "all");
is("known tab kept", knownTab("unread"), "unread");
is("unknown field falls back", knownCat("nope"), "");
is("label for a known field", catLabel("physics"), "Physics & Space");
is("label for an unknown field is the id itself", catLabel("nope"), "nope");

/* Search behaviour against the real sample content */
function find(query, tab, field) {
  library.query = query || "";
  library.tab = tab || "all";
  library.cat = field || "";
  var ids = filterTopics().map(function (t) { return t.id; });
  library.tab = "all";
  library.cat = "";
  return ids;
}

function has(query, id) {
  return find(query).indexOf(id) >= 0;
}

function inField(field) {
  return TOPICS.filter(function (t) { return t.category === field; }).map(function (t) { return t.id; });
}

is("en dash title found by a hyphen query", has("dunning kruger", "dunning-kruger"), true);

/* Accents: "Sèvres" is the only accented word in the sample content, so it is
   what the folding is actually tested against. */
var accented = TOPICS.filter(function (t) {
  return fold([t.title, t.summary].join(" ")).indexOf("sevres") >= 0;
}).map(function (t) { return t.id; });
is("the content does hold the accented word", accented, ["turkish-war"]);
is("query without the accent finds it", has("sevres", "turkish-war"), true);
is("query with the accent finds it", has("sèvres", "turkish-war"), true);

is("word order does not matter", has("war independence turkish", "turkish-war"), true);

/* "hippocampus" is in that summary and in none of its titles, so a match on it is
   a match on the summary rather than the heading. */
is("summary words match, not just titles", has("hippocampus", "memory-consolidation"), true);
is("two summary words both have to appear", has("hippocampus reconsolidation", "memory-consolidation"), true);
is("one of them is not enough", has("hippocampus zzzz", "memory-consolidation"), false);

is("a term in no field finds nothing", has("zzzzqqqq", "dunning-kruger"), false);
is("punctuation only is no constraint", find("—").length, TOPICS.length);
is("empty query is no constraint", find("").length, TOPICS.length);
is("every query token must appear", has("buttermfly effect", "butterfly-effect"), false);
is("but the real one does", has("butterfly effect", "butterfly-effect"), true);

/* Points and caveat are deliberately outside the haystack: a card shows the
   summary, so a match the reader cannot see reads as a glitch. Take a word that
   appears only in one topic's bullets and confirm it finds nothing. */
var indexed = TOPICS.map(function (t) {
  return fold([t.title, t.summary, categoryOf(t).label].join(" "));
}).join(" ");
var bulletOnly = null;
TOPICS.forEach(function (t) {
  if (bulletOnly) return;
  (t.points || []).forEach(function (point) {
    if (bulletOnly) return;
    tokensOf(point).forEach(function (token) {
      if (!bulletOnly && indexed.indexOf(token) < 0) bulletOnly = token;
    });
  });
});
is("found a word unique to the bullets to test with", bulletOnly !== null, true);
is("a bullets-only word finds nothing", bulletOnly ? find(bulletOnly).length : -1, 0);

/* The field label is in the haystack, so naming a field finds its topics. Extra
   matches are allowed: a summary may legitimately mention another field. */
includesAll("naming a field finds every topic in it", find("philosophy"), inField("philosophy"));
is("the field filter itself is exact", find("", "all", "philosophy"), inField("philosophy"));

/* Status tabs */
MARKS.learnt = { "dunning-kruger": "2026-09-22", "sky-is-blue": "2026-09-21" };
MARKS.starred = { "dunning-kruger": 1 };
is("learnt tab shows marks", find("", "learnt"), ["dunning-kruger", "sky-is-blue"]);
is("unread holds the rest", find("", "unread").length, TOPICS.length - 2);
is("learnt and unread partition the set",
  find("", "learnt").length + find("", "unread").length, TOPICS.length);
is("starred is its own axis", find("", "starred"), ["dunning-kruger"]);
is("a field narrows a tab", find("", "learnt", "physics"), ["sky-is-blue"]);
is("a query narrows a tab", find("kruger", "starred").length, 1);
is("a query can empty a tab", find("sky", "starred").length, 0);
is("content order is kept, not resorted", find("", "learnt")[0], "dunning-kruger");

/* Nothing in the content should be unreachable */
var unreachable = TOPICS.filter(function (t) { return find(t.title).indexOf(t.id) < 0; });
is("every title finds its own topic", unreachable.map(function (t) { return t.id; }), []);

var unfoundFields = CATEGORIES.filter(function (c) {
  return find(c.label).length === 0;
}).map(function (c) { return c.id; });
is("every field label finds something", unfoundFields, []);

console.log("\n" + checks + " checks, " + failures + " failure" + (failures === 1 ? "" : "s") +
            " across " + TOPICS.length + " sample topics.");
process.exit(failures ? 1 : 0);
