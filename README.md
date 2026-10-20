# Pulse

**A personal performance dashboard.** Log the handful of things that actually
matter, once a day, in under thirty seconds — then read the whole day at a
glance: three rings (Body, Mind, Attention) around one score.

Not a habit tracker. An instrument.

## Versions

Newest first. Every release is specified in its own file; the full ledger is in
[versions.md](versions.md).

| Version | Status | What it did |
| ------- | ------ | ----------- |
| [v2.3](v2.3.md) | 🚧 Planned | Undo, and the pointer and focus pass. |
| [v2.2.2](v2.2.2.md) | ✅ Shipped | The instrument opens. Every card's detail editor is rebuilt around its value: the big number is the input, the status is one sentence, and each field gets the control it deserves — a gauge, a goal-centred weight scale, a five-bar ladder, doors, a seven-day mixer, a thirty-day grid, a night strip. |
| [v2.2.1](v2.2.1.md) | ✅ Shipped | Open it up. In bed takes one entry — the wake is derived from your sleep — on a 21:00–02:00 axis with your usual window. Every card opens into a detail editor shaped to its field, and the weekly cards let you fix any day the score counts. |
| [v2.2](v2.2.md) | ✅ Shipped (early) | Log it on the board: every field answered where it is read. Landed inside v2.1.2. |
| [v2.1.2](v2.1.2.md) | ✅ Shipped | The home screen rework. One screen of instruments: a rail with the score, yesterday, usual, the next best move and the week; three category columns; a score bar at the bottom. The cards are the only inputs — no sheet. |
| [v2.1.1](v2.1.1.md) | ✅ Shipped | The density pass. Nothing stretches to fill the screen: a field is as big as what it holds, in three packed columns, and the left third now carries the category bars, a Mon–Sun week strip and three numbers. |
| [v2.1](v2.1.md) | ✅ Shipped | The UI pass. Every field answers again, one field retired, and every chart redrawn in the shape its own data has. Three-band layout, three rings. |
| [v0.2](v0.2.md) | ✅ Shipped | The board: every field for today on one non-scrolling screen, tap a tile to log it, reachable from your phone. |
| v0.1 | ✅ Shipped | The loop: one field per screen, scored rings, weekly fields, trends, insights, a 90-day demo. |

```
   MON 19 OCTOBER          ● BODY 6/9 65     ● MIND 5/5 78    ● ATTENTION 3/3 93
   ╭──────────────╮        ┌───────────────┐ ┌───────┐ ┌────────┐
   │      ╭────╮  │        │ Slept  10.25  │ │ Steps │ │  Gym   │
   │      │ 64 │  │        │ ═══▓▓▓══●───  │ ├───────┤ ├────────┤
   │      ╰────╯  │        │ 1.2h past     │ │ 2,200 │ │ 3 wks  │
   │ so far       │        └───────────────┘ └───────┘ └────────┘
   │ YEST 21  USUAL 64     … one row per pair of fields, every row full …
   │ NEXT BEST MOVE
   │ Clean day         +10
   │ 18 of 30 days  [SHOW CARD]
   │ THIS WEEK       64
   │ ◉ · · · · · ·
   ├─────────────────────────────────────────────────────────────────────────
   │ WHERE YOUR SCORE COMES FROM
   │ ▮▮▮▮▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮│▮▮▮▮
   ╰─────────────────────────────────────────────────────────────────────────
```

## Why it exists

- **The cards are the only inputs.** Every field is answered where it is read:
  drag the knob, tap the third block, flip the switch. Click the card itself and it
  opens into a detail editor — the same field, bigger, with an exact number and the
  whole week where the week is what counts. No second list of fields behind a
  button; the guided `/log` flow stays for the phone, one field a screen.
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

Open that `phone:` address on your phone and add it to the home screen: the board
is one screen tall, no scrolling, and every tile is a touch target. There is no
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
```

Everything is hand-written ES modules — no build step, no npm, no framework.

Adding a field means editing `metrics.py` once: the field, the shape it reads
best in, its weight, and whether it takes one card slot or two.

## Cloudflare-free, analytics-free, yours

Self-hosted, single process, one SQLite file. Back it up by copying it.

## Status

v2.2.2 — the whole loop works end to end, the whole day fits one screen at
1440×900 without scrolling, every field is answered in place on the board, and
every card opens into a detail editor built around its value: the number is the
input, and the field gets the control that fits it. The bed time is one entry; the
wake time is arithmetic.
Next: [v2.3](v2.3.md), undo and the pointer pass.
