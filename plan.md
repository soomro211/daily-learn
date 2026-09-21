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

- [ ] Reading view for one topic
- [ ] Summary, key points, misconception, source link
- [ ] Related-topic chips that navigate between topics
- [ ] Mark-as-learnt and star actions

**Done when:** a topic opens from the library, reads well on a phone, and
marking or starring it survives a page reload.

## M3 · Daily topic

- [ ] Today's topic on opening the app
- [ ] Same topic all day, changes the next day
- [ ] Move back and forward through previous days
- [ ] Day streak count

**Done when:** changing the device date shows a different pick, and past days
can be revisited.

## M4 · Library browsing

- [ ] Search across titles, categories and summaries
- [ ] Category filters
- [ ] All / Unread / Learnt / Starred tabs
- [ ] Progress count and bar across the whole set
- [ ] Empty states for tabs with nothing in them

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
