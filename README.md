# Pulse

**A personal performance dashboard.** Log the handful of things that actually
matter, once a day, in under thirty seconds — then read the whole day at a
glance: three rings (Body, Mind, Attention) around one score.

Not a habit tracker. An instrument.

## Versions

Pulse is built in passes, and the passes stack. **Latest: v2.2.4 — desktop
fill.** Next: **v2.3 — the phone.**

| Pass | What it changed |
| ---- | --------------- |
| [0.1 – 0.2](docs/versions/v0.2.md) | The loop, then the board: the scoring, and every field for today on one non-scrolling screen, answered in place. |
| [2.1 – 2.1.2](docs/versions/v2.1.md) | The interface: a shape per field, the density pass, and the one-screen home rework — rail, three category columns, score bar. |
| [2.2 – 2.2.4](docs/versions/v2.2.4.md) | The editor and the desktop passes: answer on the card, open it for the exact answer, and keep the board to one screen — a rail that stacks, notes on their own row, a score bar grouped by category, and a column that fills the height it has. |
| 2.3 (next) | The phone: logging first, a dashboard built for glass, undo. |
| 2.4 – 3.1 (planned) | Yours: card settings, the layout builder, the polish. |

Every release has a one-page spec in [docs/versions](docs/versions/README.md) —
the full ledger, with the numbering rules. The next four passes are in
[docs/ROADMAP.md](docs/ROADMAP.md).

```
   TUESDAY 20 OCTOBER      ● BODY 7/9 97      ● MIND 5/5 100    ● ATTENTION 3/3 70
   ╭───────────────╮      ┌──────────────────┐ ┌────────────┐ ┌──────────────┐
   │      ╭─────╮  │      │ Slept   7.75 h   │ │ Deep       │ │ Screen       │
   │      │ 89  │  │      │ ═══▓▓▓▓●▓▓────── │ │ blocks  3  │ │ 2.5 h        │
   │      ╰─────╯  │      │ Inside 7–9 h     │ │ A full day │ │ 0.5h under   │
   │ so far        │      └──────────────────┘ └────────────┘ └──────────────┘
   │ YEST 93  USUAL 95    … one row per card, sized by what it holds …
   │ NEXT BEST MOVES
   │ Clean day            +10
   │ 1 of 30 days
   │ THIS WEEK            91
   │ ◉ ● · · · · ·
   ├────────────────────────────────────────────────────────────────────────────
   │ WHERE YOUR SCORE COMES FROM
   │ ▮▮▮▮▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮
   ╰────────────────────────────────────────────────────────────────────────────
```

## Why it exists

- **The cards are the only inputs.** Every field is answered where it is read:
  drag the knob, tap the third block, flip the switch. Open the card itself and it
  becomes an instrument — the same field, bigger, with the value as the input and
  the whole week where the week is what counts. No second list of fields behind a
  button; the guided `/log` flow is still there, one field a screen.
- **One glance beats a list.** The board puts every field for today on one screen —
  no scrolling — grouped the way the rings are, and sized to what each field *is*:
  a yes/no is half a row, a gauge earns a full one. Rings cap at 100% each, so a
  strong area can never hide a neglected one.
- **Every card says where it sits.** Label and value on the left, points earned on
  the right, the instrument in the middle, and one line of plain words underneath:
  *1.2h past the band*, *2,200 to go*, *5 of 7 days*. No 7-day charts on Today —
  history lives in Trends.
- **The day, and the week, and what to do next.** The rail carries the ring and
  score with yesterday and your usual as plain numbers, the **next best move** (the
  open field with the most points left) and a Monday-to-Sunday strip of mini rings.
  The bar along the bottom splits the score into what each field is worth.
- **A shape per field.** A yes/no is drawn as two explicit segments, a band to land
  in as a band, a count you stack as blocks, a ceiling you stay under as a line you
  keep left of. The instrument is decided by the data, never by taste.
- **Room to grow, never failure.** No streaks-on-fire, no red screens, no confetti.
  A day with gaps reads as *what is still open*, and the score says *so far* until
  the categories are filled.
- **Correlation, not cause.** After a few weeks with data, the dashboard says
  things like *"on days with 7 h+ sleep your mood averages 3.9 vs 3.2"* and
  labels them as correlations.

## Run it

```bash
uv run pulse
```

That is the whole setup. `uv` creates the virtualenv, installs FastAPI, starts
the server and opens <http://localhost:8765>.

Other entry points:

```bash
uv run pulse --port 9000 --no-browser   # custom port, no browser
uv run pulse --reload                   # development, auto-reload
uv run pytest                           # tests
```

Your data lives in a single SQLite file at `.data/pulse.db` next to the project
(override with `PULSE_DB=/path/to/pulse.db`). Nothing leaves your machine.

## Use it from your phone

The server binds `0.0.0.0` by default, so any device on the same Wi-Fi can open
it. Start it as usual and it tells you the address:

```
  Pulse — One glance. Three rings. One score.
  data:  /path/to/.data/pulse.db
  open:  http://localhost:8765
  phone: http://192.168.1.24:8765   ← same Wi-Fi, nothing to install
```

Open that `phone:` address on your phone and add it to the home screen. The board
folds to one column there and every card opens into the same instrument you get on
the desktop — the phone is a first-class surface, not a viewer. The guided `/log`
flow is the one-field-per-screen alternative for a thumb. There is no
authentication — it is your own machine on your own network. To keep it to this
machine again, run it with the host pinned:

```bash
PULSE_HOST=127.0.0.1 uv run pulse
```

## The pages

| Page        | What it is                                                        |
| ----------- | ----------------------------------------------------------------- |
| `/`         | Today: the board — rings, categories and the week on the left, every field on the right, tap a tile to log it in place |
| `/log`      | The guided flow — one field per screen, live ring feedback       |
| `/calendar` | Apple-style score rings per day, tap a day for the full sheet     |
| `/trends`   | Plain sentences with sparklines, previous window vs this window    |
| `/insights` | What moves your mood and energy, labelled as correlation           |
| `/demo`     | 90 days of believable data: weekend dips, a streak, one rough week |
| `/settings` | Names and targets that are yours                                   |

## Automation

Anything that can POST JSON can feed the dashboard:

```bash
curl -X POST http://localhost:8765/api/import -H 'content-type: application/json' -d '{
  "days": [
    {"day": "2026-10-18", "values": {"steps": 9412, "sleep_hours": 7.5, "screen_hours": 2.75}, "source": "apple-health"}
  ]
}'
```

Sleep, steps, screen time and pickups are marked as auto-import fields. Log them
by hand on any day the phone did not.

## Layout of the code

```
src/pulse/
  metrics.py       the field catalogue and the board's tile catalogue
  scoring.py       pure scoring primitives (ramps, plateaus, rhythm spread)
  analytics.py     day scores, rings, focus line, trends, weekly progress
  insights.py      correlation-style insights with a minimum evidence bar
  repository.py    day entries and settings in SQLite
  demo.py          deterministic 90-day demo dataset
  net.py           the LAN address a phone should use
  api/             FastAPI routers (days, analytics)
web/
  css/tokens.css   colours, spacing, type scale — the design system
  css/board.css    the board: the rail, three category columns, the card and its
                   instruments, states, the score bar, four breakpoints
  css/editor.css   the detail editor's controls
  js/core/         api client, dom helpers, formatting, motion, haptics
  js/rings.js      the ring renderer used by every page
  js/components/   card.js (one card, all instruments, inline logging),
                   editor.js (the detail sheet, one editor per field shape), sheet, toast
  js/views/        one small module per page
docs/
  ROADMAP.md       the next four passes, briefly
  versions/        the ledger and one page per shipped release
  notes/           the original brief and the v2.1.2 design brief
```

Everything is hand-written ES modules — no build step, no npm, no framework.

Adding a field means editing `metrics.py` once: the field, the shape it reads
best in, its weight, and whether it takes one card slot or two.

## Cloudflare-free, analytics-free, yours

Self-hosted, single process, one SQLite file. Back it up by copying it.

## Status

**v2.2.4 — desktop fill.** The whole day still fits one screen at 1440×900
without scrolling, and now it fills it. The board is three category columns;
a column is a stack of rows, a row is a pair of cards, and every category has
its own plan for how tall its rows are. Mind and Attention no longer end
hundreds of pixels above the score bar: the track thickens, the deep blocks
and the mood chips grow, the clean grid takes its card, and the note that
opens under Read, Learned or Main task takes its height from the rows around
it — never from the bar. Tablet and phone keep the content-sized layout, and
the growth is capped, so a tall window leaves the room below the board rather
than turning every card into a billboard.

The v2.2.3 rail is unchanged: the larger ring, yesterday and usual, the three
next best moves, the week and a Sources card that stays only until both
imports are live. Main task is a scored switch, notes open as a full-width
row, mood and energy are one row of chips, the score bar is grouped by
category, and a perfect day gets one slow light sweep.

This is the basis everything else builds on: the board, the scoring and the
instrument catalogue — now with Main task — are settled, and the next passes
add surfaces and choice rather than changing what is measured. Next:
**v2.3 — the phone** ([roadmap](docs/ROADMAP.md#v23--the-phone)).
