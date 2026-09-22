/* The shuffle's deck, checked against the real content.

   A roll has to do three things at once: never hand back a topic already marked,
   never hand back the topic already on screen, and stay varied — picking one of
   thirteen at random repeats often enough to look broken, which is exactly the
   failure the daily picker had before it became a deck. None of that is visible in
   a single roll, so it is checked over long runs instead.

   Run with: node tests/shuffle-deck.js

   The functions are read out of js/app.js rather than copied, so this exercises the
   code that ships. The order within a stack is genuinely random; every assertion
   below is about the properties that hold whatever order comes out. */

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

/* The data file only assigns to window.*, so a global stub is enough to load it. */
global.window = {};
require(path.join(root, "data", "topics.js"));

var TOPICS = global.window.DL_TOPICS;
var TOPIC_BY_ID = {};
TOPICS.forEach(function (t) { TOPIC_BY_ID[t.id] = t; });

var LEARNT = {};
var Marks = { isLearnt: function (id) { return !!LEARNT[id]; } };

/* The shipped state object, with only the fields the deck reads. */
var shuffle = { cat: "", order: [], shown: null, learntToo: false };

eval(grab("mulberry32"));
eval(grab("permutationOf"));
eval(grab("shufflePool"));
eval(grab("stillInPlay"));
eval(grab("openShuffleDeck"));
eval(grab("drawNext"));

var failures = 0;
var checks = 0;

function is(label, actual, expected) {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures += 1;
    console.log("  FAIL  " + label + "\n          got  " + JSON.stringify(actual) +
                "\n          want " + JSON.stringify(expected));
  }
}

function reset() {
  LEARNT = {};
  shuffle.cat = "";
  shuffle.order.length = 0;
  shuffle.shown = null;
  shuffle.learntToo = false;
}

function mark(id) { LEARNT[id] = "2026-09-22"; }
function fieldOf(id) { return TOPIC_BY_ID[id].category; }

/* One roll, with the deck generation it came out of. A generation begins whenever
   the stack is found empty, which is the only moment a new shuffle is dealt — so
   grouping rolls this way is what lets the no-duplicates rule be stated exactly
   rather than approximated over a window. */
function rollAll(count, dealt) {
  var generation = 0;
  for (var i = 0; i < count; i += 1) {
    if (!shuffle.order.length) generation += 1;
    var id = drawNext();
    if (id === null) return false;
    shuffle.shown = id;
    dealt.push({ id: id, generation: generation });
  }
  return true;
}

/* ---------------------------------------------------------- over the whole set */
reset();
var all = [];
rollAll(1297, all);

is("1,297 rolls from every field all deal a topic", all.length, 1297);

var immediate = [];
for (var i = 1; i < all.length; i += 1) {
  if (all[i].id === all[i - 1].id) immediate.push(i);
}
is("no roll ever repeats the one before it", immediate, []);

var withinGeneration = [];
var seen = {};
all.forEach(function (card) {
  if (card.generation !== seen.g) { seen = { g: card.generation, ids: {} }; }
  if (seen.ids[card.id]) withinGeneration.push("g" + card.generation + ":" + card.id);
  seen.ids[card.id] = true;
});
is("a topic comes up once per stack, not twice", withinGeneration, []);

var counts = {};
var last = {};
var longestWait = 0;
all.forEach(function (card, index) {
  counts[card.id] = (counts[card.id] || 0) + 1;
  if (last[card.id] !== undefined) {
    longestWait = Math.max(longestWait, index - last[card.id]);
  }
  last[card.id] = index;
});
var spread = TOPICS.map(function (t) { return counts[t.id] || 0; });
var low = Math.min.apply(null, spread);
var high = Math.max.apply(null, spread);
is("every topic comes up across 100 stacks", low > 0, true);
/* A stack holds every topic once, so the only unevenness a run can show comes from
   the partial stack it happens to stop inside: one appearance, at most. Anything
   wider than two means a topic is being traded out of a turn it should have had. */
is("the deal stays level to within two", high - low <= 2, true);
/* The price of holding a topic to one turn per stack: the worst wait is a topic
   coming up first in one stack and last in the next, which is two stacks short of a
   roll. Anything longer means the stack is not being turned over at all. */
is("no topic waits more than two stacks", longestWait <= TOPICS.length * 2, true);

/* -------------------------------------------------------------- marks respected */
reset();
TOPICS.slice(0, 8).forEach(function (t) { mark(t.id); });
is("the pool holds only unmarked topics", shufflePool().length, 5);

var marked = [];
var dealt = [];
rollAll(400, dealt);
dealt.forEach(function (card) { if (LEARNT[card.id]) marked.push(card.id); });
is("a marked topic is never dealt", marked, []);
is("with five unmarked, every roll finds one", dealt.length, 400);
var distinct = {};
dealt.slice(0, 5).forEach(function (card) { distinct[card.id] = true; });
is("the five unmarked topics all appear inside five rolls", Object.keys(distinct).length, 5);

/* Marking something *after* the stack was dealt must not let it through: the card
   is still in the queue, and the roll has to notice it has been taken. */
reset();
var queue = [];
rollAll(4, queue);
TOPICS.forEach(function (t) { if (t.id !== queue[queue.length - 1].id) mark(t.id); });
var leaked = [];
for (var pass = 0; pass < 12; pass += 1) {
  var found = drawNext();
  if (found !== null && LEARNT[found]) leaked.push(found);
  if (found !== null) shuffle.shown = found;
}
is("nothing marked since the stack was dealt still slips out", leaked, []);

/* ------------------------------------------------------------ one field at a time */
reset();
shuffle.cat = "psychology";
var wrong = [];
var psych = [];
rollAll(120, psych);
psych.forEach(function (card) { if (fieldOf(card.id) !== "psychology") wrong.push(card.id); });
is("a roll within one field leaves that field", wrong, []);
var both = {};
psych.forEach(function (card) { both[card.id] = true; });
is("and reaches both of its topics", Object.keys(both).sort(),
  TOPICS.filter(function (t) { return t.category === "psychology"; })
    .map(function (t) { return t.id; }).sort());

/* A field with one topic in it: the exclusion that stops an immediate repeat would
   empty the stack, so it is waived rather than obeyed, or the roll would have
   nothing to show. */
reset();
shuffle.cat = "engineering";
is("a field of one topic is still rollable", drawNext(), "shipping-container");
is("and again the next time", drawNext(), "shipping-container");

/* A change of field keeps the same rule: the card you are looking at is the last
   thing a fresh stack should hand back. */
reset();
shuffle.shown = "turkish-war";
shuffle.cat = "history";
is("the first card of a new field is not the one still on screen",
  drawNext(), "fall-of-constantinople");

/* ------------------------------------------------------- nothing left to roll */
reset();
TOPICS.filter(function (t) { return t.category === "history"; })
  .forEach(function (t) { mark(t.id); });
shuffle.cat = "history";
is("a fully marked field has nothing to deal", drawNext(), null);

/* The fallback: accepted from the empty state, it puts the marked ones back in
   play rather than leaving the screen with a dead button. */
shuffle.learntToo = true;
shuffle.order.length = 0;
var fallback = drawNext();
is("rolling through marked ones finds a topic", !!TOPIC_BY_ID[fallback], true);
is("and it is one of that field's", fieldOf(fallback), "history");
is("with marked ones in play the whole field is the pool", shufflePool().length, 2);

/* The last topic unmarked, then marked while the roll is being used. */
reset();
TOPICS.slice(1).forEach(function (t) { mark(t.id); });
is("one topic left is still a stack", drawNext(), TOPICS[0].id);
mark(TOPICS[0].id);
is("and marking it empties the stack rather than looping", drawNext(), null);

/* --------------------------------------------------------------- every field */
var emptied = [];
global.window.DL_CATEGORIES.forEach(function (cat) {
  reset();
  shuffle.cat = cat.id;
  var inField = TOPICS.filter(function (t) { return t.category === cat.id; });
  if (!inField.length) { emptied.push(cat.id); return; }
  var rolled = [];
  rollAll(inField.length, rolled);
  var ids = rolled.map(function (c) { return c.id; }).sort();
  var want = inField.map(function (t) { return t.id; }).sort();
  is(cat.id + ": a stack of " + want.length + " deals each topic once", ids, want);
});
is("no field in the sample data is empty", emptied, []);

console.log("\n" + checks + " checks, " + failures + " failure" + (failures === 1 ? "" : "s") +
            " over " + TOPICS.length + " topics.");
process.exit(failures ? 1 : 0);
