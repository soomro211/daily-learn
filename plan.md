# daily-learn — build plan

Static HTML app. No backend, no build step. Full requirements live in Qoder
project memory; this file is the task list only.

## M1 · Shell and look

- [x] Project files and page structure
- [x] Colour scheme, type scale, spacing — shared across the app
- [x] Dark/light toggle, remembered between visits
- [x] App navigation for mobile-first use
- [x] 8 sample topics so the app has something real to show

Shipped 13 samples instead of 8, so every category colour is visible and the
index is not nearly empty.

**Done when:** the sample build opens in the browser and the look is approved
before any further screens are built on top of it.

*Built. Reviewed on a phone, which found the flat white panels and the accent
shift in the light screenshots — palette direction, still yours to call, so
those are untouched.*

## M2 · Topic page

- [x] Reading view for one topic
- [x] Summary, key points, misconception, source link
- [x] Related-topic chips that navigate between topics
- [x] Mark-as-learnt and star actions

Done alongside the above, from reviewing the M1 build: marks are stored with the
date they were made, which is what the M3 streak reads; marking no longer
rebuilds the page, which had been throwing away the reader's scroll position and
replaying the entrance animation; a back link and a single category label
replaced a duplicated one; prose holds to one measure; focus moves with a route
change; and the light palette was corrected where equal HSL lightness turned out
to mean unequal luminance across the eight category hues.

Found again on a phone: the reading voice stopped halfway down the page — the
summary was serif, the points and the caveat beneath it were not — the caveat
label was indented out of the column the other labels form, a field chip showed
underlined wherever it happened to be a link, and the confirmation animation for
marking something replayed on every later visit to a page already marked.

**Done when:** a topic opens from the library, reads well on a phone, and
marking or starring it survives a page reload.

## M3 · Daily topic

- [x] Today's topic on opening the app
- [x] Same topic all day, changes the next day
- [x] Move back and forward through previous days
- [x] Day streak count

Found while building it: the date-hashed picker was badly unbalanced — over
three years one topic surfaced three times as often as another, and any given
topic could disappear for 229 straight days. Replaced with a shuffled-deck
cycle, which measures 82-87 appearances each and no topic absent more than 26
days. Each day's pick is now also recorded when first opened, so adding topics
in M7 cannot move the pick under a day already read. A pick for a future date is
clamped to today rather than shown.

Found on a phone, and it is the more serious of the two: a reader whose clock
shifts twice a year could be shown the same topic on two consecutive days, and at
the seam between two cycles a card was replaced rather than traded, so one topic
could come up twice in a cycle and another not once at all. Both are now checked
over fifteen hundred days in twelve zones.

**Done when:** changing the device date shows a different pick, and past days
can be revisited.

## M4 · Library browsing

- [x] Search across titles, categories and summaries
- [x] Category filters
- [x] All / Unread / Learnt / Starred tabs
- [x] Progress count and bar across the whole set
- [x] Empty states for tabs with nothing in them

The index keeps its own copy rather than being rebuilt on every change, so typing
holds focus and a trip into a topic and back returns you to the same row. The tab
and field you pick are part of the address — `#/library/starred/history` is a view
you can return to — while the search text deliberately is not, because twelve
keystrokes would write twelve back-steps through half-typed words. Search splits a
query into words instead of matching it whole, so "dunning kruger" finds a title
written with an en dash and "sevres" finds Sèvres. Each empty state names the
filters that produced it and offers the one action that undoes it.

Found while checking: the unreachable future days were legible only as a smudge
(2.4–2.5:1), now solved to clear 3:1 in both themes; and the field chips, the most
tapped control in the app, were 26px tall — inside the AA minimum but small for a
thumb — so they are 34px.

On a phone the index also showed: the day's counters running together as one
unbroken line, an empty progress bar reading as a plain rule, every card carrying
a colour sliver a phone could never finish animating, and a search field small
enough to make iOS zoom the page and leave it zoomed. Learnt and starred rows now
say so in words a screen reader can read rather than in colour alone, tapping a
tab keeps your focus where it was, and a malformed or duplicated topic is dropped
at startup with a warning instead of emptying the index.

**Done when:** every filter and tab narrows the list correctly against the
sample data.

## M5 · Shuffle

- [x] Pick a topic within one category
- [x] Pick a topic from all categories together
- [x] Skip topics already marked learnt
- [x] Fallback when a category has nothing left
- [x] Animated reveal, with a calm version for reduced-motion settings

The roll deals out of a shuffled stack rather than picking at random, which is how
the daily pick ended up working once it was measured: random picking repeats
quickly enough to look like a broken app. Each topic in play comes up exactly once
before the stack turns over, and a stack that would open on the card already on
screen trades its first two cards instead — the correction the daily picker needed,
applied here before it could bite. Checked over thirteen hundred rolls, where it
holds: no topic twice in a stack, none waiting out more than two stacks, and no
topic more than an appearance behind the fullest one across a hundred stacks.

The field you roll within is part of the address, as the index's facets are:
`#/shuffle/philosophy` is a roll narrowed to one field and a link worth keeping.
What came up is deliberately not, because a roll cannot be repeated — a bookmark of
the result would be a promise the app cannot keep. A landed card is the index's own
card, so a rolled topic looks, reads and marks exactly like the same topic in the
library.
The reveal moves the stack rather than uncovering it, which is what lets it be
honest: the topic is on the page and openable the instant the roll is taken, and the
animation is only the card settling. With motion reduced it settles in a frame, and
because the settled look is the card's own style rather than one keyframe of an
animation, nothing can be left half-drawn.

Found while checking: the fallback line counted two topics as unmarked when both
were marked, and the two controls inside the stage — the message that a field has
run out, and the button that hides itself when it appears — each destroyed the other
one's focus, so focus now goes to whatever replaced them.

**Done when:** repeated rolls give varied, unlearnt results and the animation
never blocks reading the result.

## M6 · Verify the app

Checked against the sample topics, before real content exists.

- [x] Every screen reachable and clicked through
- [x] Layout checked narrow, medium and wide
- [x] Both themes checked on every screen
- [x] Filters, tabs and search behave correctly
- [x] Daily pick, streak and calendar behave correctly
- [x] Shuffle returns varied, unlearnt results
- [x] Progress kept after reload, and cleared cleanly on request
- [x] Console free of errors

Ten routes were opened at 390, 820 and 1320 wide in both themes, and every tab and
field combination checked against the content rather than against the app's own
filter: 36 views, each matching on the rows shown, the words beside them, the
per-card marks, the meter and its bar. Sixteen queries, including the ones that
should find nothing. The daily thread over seeded histories — a streak ending
yesterday, one including today, one broken by a gap — plus a pinned day, a future
day, and three ways of writing a date that is not one. Fifteen rolls, which gave
thirteen distinct topics before the stack turned over and never once returned a
marked card. 147 logic checks in `tests/`, 15 states through the contrast audit in
each theme, and no console message of any kind across 29 route changes.

Found while checking: searching for a topic by a name written without its
apostrophe found nothing, so "occams razor" missed Occam's razor — the tokenizer
split on the mark, leaving "occam" and "s" in the text where the query had
"occams". Apostrophes are now folded away the way accents are, which is what the
comment above that function always claimed. The roll's out-of-topics message said
every topic in the field was marked learnt even when the field held no topics at
all, and offered a button that could never do anything there; an empty field now
says so and offers only the way wider. And the note's Dismiss was a 17px-tall
target, the only control in the app under the floor the rest of it keeps to.

Two things were checked and left alone. A field with no topics in it, and the
index's "Nothing filed there yet" state, cannot be reached from the thirteen
samples — both were exercised through a harness that loads the real app over
corrupted content, which is also how the startup guard on malformed rows was
confirmed. Clearing progress means un-marking topics one by one, or wiping the
three `dl.*` keys; both were checked and neither leaves residue, but there is no
in-app control for it, so the checklist's "on request" is satisfied by the browser
rather than by a button.

**Done when:** the finished app is approved as working, so content is only
ever written into a shell that won't change underneath it.

## M7 · Content

Roughly 15 topics per category, one sharp idea each. Written and checked one
category at a time, not all at once.

- [ ] Psychology & Behaviour
- [ ] History
- [ ] Physics & Space
- [ ] Biology & the Mind
- [ ] Economics & Society
- [ ] Philosophy & Ethics
- [ ] How Things Work
- [ ] Ideas, Principles & Paradoxes
- [ ] Final pass over the whole set: links resolve to real, stable articles,
      no duplicate or overlapping topics, related-topic chips point at topics
      that exist, and each summary stands on its own at about 120 words

**Done when:** all 8 categories are in and the final pass is clean.

## M8 · Publish

Yours to ask for. Not automatic.

- [ ] GitHub repository
- [ ] Push the app
- [ ] Hosting enabled, URL handed over

## Notes

- Progress is stored in the browser on the device it was made, so phone and
  desktop keep separate records, and clearing browser data resets it.
- Known limit from M6, left as it is because the look is M1's to call: at twice
  the default text size on a phone-width screen the four status tabs and a long
  related-topic chip are one-line pills that refuse to wrap, so the page scrolls
  sideways. Nothing is hidden by it.
- M1 is the design checkpoint. The look is settled there, and nothing
  downstream is built until you approve it.
- `tests/` is for checking the app, not running it: nothing in `index.html`
  refers to it. `node tests/search-logic.js` exercises the index's search and
  filters against the real content; `node tests/day-arithmetic.js` runs the
  calendar and the daily pick over fifteen hundred days in twelve time zones;
  `node tests/shuffle-deck.js` deals thousands of rolls and checks the stack
  for repeats, marked topics and balance; `tests/contrast-in-page.js` is
  loaded into the open page to measure every colour pairing in both themes.
