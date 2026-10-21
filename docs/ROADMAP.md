# Roadmap

**The basis is v2.2.6.** The board is the dashboard: every field is answered in
place, and every card opens into an instrument built around its value. The
desktop passes added Main task, finished the rail, made the columns fill the
height they have, and made the board answer while you drag — with a ladder on
Mood and Energy that reads like the editor's. Everything below builds on that —
the passes add surfaces and choice, not new scoring, and never change what the
fields mean or the single-file storage.

Three rules hold for every pass on this page:

- **Today first.** No history charts on the board. History lives in Trends and the
  calendar.
- **One accent per category, no red, no confetti.** Urgency is said in words and
  in amber, never in alarm.
- **The cards are the only inputs.** A new surface may replace the board on a
  phone, but it may not become a second list of fields.

---

## The four passes

| Release | Focus | In one line |
| ------- | ----- | ----------- |
| **v2.3** | The phone | Make the phone the best place to log, and the board readable there. |
| **v2.4** | Card settings | Let a card be hidden, renamed, resized, and drawn in another of the shapes we already have. |
| **v3** | The builder | Let the whole board be arranged — keep, order, size — and more fields added. |
| **v3.1** | The polish | Make any arrangement look deliberate: one card or thirty. |

---

## v2.3 — The phone

Today the phone gets a tall single column: the rings, yesterday/usual, the next
best move, then all sixteen cards. It works. It is not the best way to log, which
is the thing the phone is actually for.

**What a 390-wide capture actually shows**

- The rail fills the first screen — ring, Yesterday, Usual, next best move, week —
  so no card is visible without scrolling.
- The top bar runs out of room at `Tre…`: Trends, Insights, Demo and Settings are
  off-screen, with no visible affordance that they exist.
- The thirty-day clean grid and the score bar run past the right edge.
- The cards themselves read well — large, legible instruments with generous
  targets. The problem is the frame around them, not the cards.

**Logging first**

- **The head opens, the instrument logs.** Tapping a card's label/value row opens
  the instrument as a full sheet; the instrument itself still answers in one
  gesture, exactly as on the desktop. The sheet is for the precise answer, not the
  only answer.
- **A bottom sheet that behaves.** Safe-area insets, a sticky footer, the value
  kept above the keyboard, `Done` always in thumb reach, swipe-down to dismiss.
- **Thumb-sized everything.** 44px minimum targets, 8px between them, no
  hover-only affordances, and no zoom-jump when the hero input takes focus.
- **Open fields first.** With the score incomplete, the board orders open cards
  before logged ones, with a quiet `Open / All` switch. A phone session should not
  scroll past eight finished cards to reach the one gap.
- **A navigation that fits.** Either a bottom bar (Today, Log, Trends, More) or a
  single overflow menu — decided against the real device, but the current
  cut-off nav cannot ship.
- **Undo, at last.** Every write raises a four-second *Undo* toast. On glass a
  stray tap is the failure mode, so live writes get a net instead of a
  confirmation dialog. (This is the old v2.3 plan, folded in here because the
  phone is where it matters.)
- **`/log` stays, demoted.** One field per screen is still a good path; it stops
  being the recommended mobile route.

**The dashboard, small**

- The rail compresses to one sticky summary bar — score, three ring segments, the
  next best move. Tapping it jumps to that card.
- Categories collapse, with `3/5` still visible in the header.
- The week strip scrolls horizontally instead of squeezing seven rings.
- The clean grid reflows to 6 × 5, so no cell is clipped.
- The score bar wraps or scrolls; nothing bleeds past the viewport.
- One column below 1000px, as today: cards two-up inside a category until 460px,
  then one.

**Done when** every field for today can be logged from a phone in one pass without
pinch-zooming or horizontal overflow, and the board reads at 390×844 with the
whole navigation reachable.

---

## v2.4 — Card settings

Settings stops being three fields and becomes the place a card is configured. The
shape picker is the vocabulary v3 will reuse.

- **Show / hide** any card.
- **Rename** it. The label changes; the field id, its score and its history do not.
- **Fields.** Choose which metric a card carries where more than one fits, and add
  a secondary field to a card where the shape allows it (a note under a boolean, a
  count beside a gauge). The score follows the field, never the card.
- **Choose the display** from the shapes the field already supports: gauge, bar,
  band, blocks, ladder, doors, segments, week mixer, clean grid, night strip, big
  number. The picker only offers what the data can honestly be drawn as.
- **Choose what it shows** where a card holds more than one thing — value only,
  value + gap sentence, value + week.
- **Size hint** — compact / standard / wide — honoured when the board has room.
  v3 turns this into free placement.
- **Targets and presets** move under the card they belong to (gym target, weight
  goal, thresholds), so a card is configured in one place.
- **Safe.** A *Reset card* per row and a *Reset all* at the bottom. Stored in the
  existing SQLite settings; a user who never opens Settings sees today's board
  exactly.

Order here is still the catalogue order, with up/down. Dragging is v3.

---

## v3 — The builder

The board becomes a grid the user arranges.

- **The grid.** Drag to move, handles to resize. Sizes the instruments support:
  small 1×1, wide 2×1, tall 1×2, large 2×2. Twelve columns on desktop, four on
  tablet, one on phone, with a separate arrangement per breakpoint (or *follow
  desktop*).
- **Keep, order, group.** Choose which cards exist; move them within or across
  categories; rename a category, or dissolve the categories into one stream.
- **The instrument catalogue is public.** Every shape the app can draw, what data
  it needs, the sizes it supports — documented and offered in the picker. No shape
  is welded to one field.
- **Add fields.** A library of extra metrics, attention first — social minutes,
  notifications, focus sessions, deep-work minutes — then body and mind extras.
  Each arrives with a default instrument, a score weight and a target, and can be
  added unscored.
- **Presets.** `Today` (the current board), `Training`, `Focus`, `Minimal` (score
  and next move only), plus the user's own saved boards.
- **Safe.** Reset to default, preview before saving, and the Today-first rules
  still apply.

---

## v3.1 — The polish

v3 makes arrangement possible; this pass makes it beautiful.

- Every arrangement looks deliberate: consistent gaps, rows that fill, no orphan
  card at half width, a real empty state, and a practical maximum card count.
- Audit 1, 6, 16 and 30 cards across 1440, 1920, 1024, 768 and 390.
- Motion, focus order and keyboard flow survive a reordered board.
- Performance: a forty-card board still paints in one frame, and the payload sends
  only what is placed.
- A final pass on the instrument catalogue so every shape looks like it came from
  the same instrument.

---

## Not on this page

Accounts, sync, notifications, social anything, and history on the board. Pulse
stays one process, one SQLite file, on your own machine.
