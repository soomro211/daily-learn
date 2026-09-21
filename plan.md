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

*Built; the gate is still your approval of the look.*

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

**Done when:** every filter and tab narrows the list correctly against the
sample data.

## M5 · Shuffle

- [ ] Pick a topic within one category
- [ ] Pick a topic from all categories together
- [ ] Skip topics already marked learnt
- [ ] Fallback when a category has nothing left
- [ ] Animated reveal, with a calm version for reduced-motion settings

**Done when:** repeated rolls give varied, unlearnt results and the animation
never blocks reading the result.

## M6 · Verify the app

Checked against the sample topics, before real content exists.

- [ ] Every screen reachable and clicked through
- [ ] Layout checked narrow, medium and wide
- [ ] Both themes checked on every screen
- [ ] Filters, tabs and search behave correctly
- [ ] Daily pick, streak and calendar behave correctly
- [ ] Shuffle returns varied, unlearnt results
- [ ] Progress kept after reload, and cleared cleanly on request
- [ ] Console free of errors

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
- M1 is the design checkpoint. The look is settled there, and nothing
  downstream is built until you approve it.
- `tests/` is for checking the app, not running it: nothing in `index.html`
  refers to it. `node tests/search-logic.js` exercises the index's search and
  filters against the real content; `tests/contrast-in-page.js` is loaded into
  the open page to measure every colour pairing in both themes.
