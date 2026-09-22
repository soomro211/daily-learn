/* Day arithmetic and the daily pick, checked across timezones.

   The pick is derived from a day number, so a day number that repeats or skips
   breaks two things the app promises: one topic a day, and no topic twice in a
   row. Both were true of the shipped code in Europe/London until this test was
   written — local midnight divided by a day's milliseconds repeats a number on
   the spring-forward Sunday and skips one in the autumn.

   Run with: node tests/day-arithmetic.js

   The functions are read out of js/app.js rather than copied, so this exercises
   the code that ships. */

var fs = require("fs");
var path = require("path");

var source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

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

var DAY = ["isoDay", "parseIsoDay", "dayNumber", "addIsoDays", "daysBetween"];
var PICK = ["mulberry32", "permutationOf", "deckFor", "indexOfTopicOn"];

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

function pad(n) { return (n < 10 ? "0" : "") + n; }

/* Zones chosen to be awkward, not polite: one straddling UTC where the bug lived,
   one half-hour offset, three-quarter-hour and quarter-hour offsets, a southern
   hemisphere switch, and a zone that has changed its own offset by decree. */
var ZONES = ["Europe/London", "Europe/Lisbon", "Europe/Dublin", "America/New_York",
  "America/Santiago", "Australia/Sydney", "Australia/Lord_Howe", "Asia/Kathmandu",
  "Pacific/Chatham", "Pacific/Apia", "Asia/Karachi", "UTC"];

var LENGTH = 13;          /* the sample set's topic count */
var DAYS = 1500;          /* four years of switches, several times over */

function runZone(zone) {
  process.env.TZ = zone;
  var scope = { DECKS: {} };
  /* Re-declare per zone: the eval'd helpers close over these. */
  var DECKS = scope.DECKS;
  eval(DAY.map(grab).join("\n"));
  eval(PICK.map(grab).join("\n"));

  var badSteps = [];
  var adjacentRepeats = [];
  var appearances = {};
  var cursor = new Date(2024, 0, 1);
  var previousNumber = null;
  var previousIso = null;
  var previousIndex = null;

  for (var i = 0; i < DAYS; i += 1) {
    var iso = isoDay(cursor);
    var number = dayNumber(cursor);

    if (previousNumber !== null && number !== previousNumber + 1) {
      badSteps.push(iso + " delta=" + (number - previousNumber));
    }
    /* Round trip: a date parsed from its own ISO string must count the same. */
    if (dayNumber(parseIsoDay(iso)) !== number) badSteps.push(iso + " round trip");
    if (addIsoDays(iso, 1) !== isoDay(new Date(cursor.getTime() + 864e5))) {
      /* setDate is the safe path, so the two must agree on the next calendar day. */
      var next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      if (addIsoDays(iso, 1) !== isoDay(next)) badSteps.push(iso + " addIsoDays");
    }

    var index = indexOfTopicOn(cursor, LENGTH);
    if (index === previousIndex) adjacentRepeats.push(iso);
    previousIndex = index;
    appearances[index] = (appearances[index] || 0) + 1;

    previousNumber = number;
    previousIso = iso;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  var counts = [];
  for (var k = 0; k < LENGTH; k += 1) counts.push(appearances[k] || 0);
  var low = Math.min.apply(null, counts);
  var high = Math.max.apply(null, counts);

  is(zone + ": every day number steps by one", badSteps, []);
  is(zone + ": no topic twice on consecutive days", adjacentRepeats, []);
  /* A window that does not begin on a cycle boundary must end on one eventually,
     so the head and tail partials can each favour a different topic: two apart is
     the most a correct deck can show. Whole cycles are checked for exactness
     separately, below. */
  is(zone + ": an unaligned window stays within two of level", high - low <= 2, true);
  is(zone + ": no topic absent for more than a full cycle",
    counts.every(function (c) { return c > 0; }), true);
}

/* Over whole cycles the deck is exact: every topic once, no exceptions. That is
   the property the substitution bug broke, and an aligned window is the only
   place it can be observed. */
function runExactness(zone) {
  process.env.TZ = zone;
  var DECKS = {};
  eval(DAY.map(grab).join("\n"));
  eval(PICK.map(grab).join("\n"));

  var cursor = new Date(2024, 0, 1);
  while (dayNumber(cursor) % LENGTH !== 0) cursor.setDate(cursor.getDate() + 1);

  var appearances = {};
  var days = LENGTH * 40;
  for (var i = 0; i < days; i += 1) {
    var index = indexOfTopicOn(cursor, LENGTH);
    appearances[index] = (appearances[index] || 0) + 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  var counts = [];
  for (var k = 0; k < LENGTH; k += 1) counts.push(appearances[k] || 0);
  is(zone + ": over " + days + " aligned days every topic appears exactly 40 times",
    counts.every(function (c) { return c === 40; }), true);
}

ZONES.forEach(runZone);
ZONES.forEach(runExactness);

/* Impossible dates must be rejected rather than rolled into a real one. */
process.env.TZ = "Europe/London";
eval(DAY.map(grab).join("\n"));
is("2026-02-30 is not a day", parseIsoDay("2026-02-30"), null);
is("2025-02-29 is not a day", parseIsoDay("2025-02-29"), null);
is("2028-02-29 is a day", parseIsoDay("2028-02-29") !== null, true);
is("month 13 is not a month", parseIsoDay("2026-13-01"), null);
is("2026-01-1 is a day", parseIsoDay("2026-01-01") !== null, true);
is("adding a day across a switch lands on the next date", addIsoDays("2026-03-28", 1), "2026-03-29");
is("subtracting back over it returns", addIsoDays("2026-03-29", -1), "2026-03-28");
is("a year of days is 365 apart", daysBetween("2025-01-01", "2026-01-01"), 365);
is("a leap year of days is 366 apart", daysBetween("2024-01-01", "2025-01-01"), 366);

console.log("\n" + checks + " checks, " + failures + " failure" + (failures === 1 ? "" : "s") +
            " across " + ZONES.length + " zones and " + DAYS + " days.");
process.exit(failures ? 1 : 0);
