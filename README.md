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
| [v2.2](v2.2.md) | 🚧 Planned | Log it on the board: drag the knob, tap the block, flip the switch. No sheet. |
| [v2.1.1](v2.1.1.md) | ✅ Shipped | The density pass. Nothing stretches to fill the screen: a field is as big as what it holds, in three packed columns, and the left third now carries the category bars, a Mon–Sun week strip and three numbers. |
| [v2.1](v2.1.md) | ✅ Shipped | The UI pass. Every field answers again, one field retired, and every chart redrawn in the shape its own data has. Three-band layout, three rings. |
| [v0.2](v0.2.md) | ✅ Shipped | The board: every field for today on one non-scrolling screen, tap a tile to log it, reachable from your phone. |
| v0.1 | ✅ Shipped | The loop: one field per screen, scored rings, weekly fields, trends, insights, a 90-day demo. |

```
   ╭──────────────╮   BODY ──────────────────────────────────── 6 / 6
   │   ╭──────╮   │   ┌────────────────┐ ┌───────┐ ┌────────┐
   │   │      │   │   │ sleep    ──●── │ │ steps │ │  gym   │
   │   │  77  │   │   │ ╰────────────╯ │ ├───────┤ ├────────┤
   │   ╰──────╯   │   ├────────────────┤ │alcohol│ │ greens │
   │  MON 19 OCT  │   │ weight  ╱╲╱╲   │ ├───────┤ ├────────┤
   │  12 of 13    │   │ rhythm  ▬▬▬    │ │outdoor│ │creatine│
   ├──────────────┤   MIND ──────────────────────────────────── 5 / 5
   │ BODY     89  │   ▐ deep ▐▐▐   learned ────────●   read  ▐
   │ MIND     58  │   ────────────────────────────────────────────
   │ ATTENTION 85 │   ATTENTION ───────────────────────────────── 2 / 2
   ├──────────────┤   ┌────────────────┐ ┌───────┐
   │ M T W T F S S│   │ screen   ──●── │ │pickups│
   │ ▁ ▂ ▄ · · · ·│   │ ╰────────────╯ │ └───────┘
   │ 77  1/7  77  │   └────────────────┘
   ╰──────────────╯
```

## Why it exists

- **Logging is the point.** One field per screen in the guided flow, sized to the
  field type, prefilled with yesterday's value. Each answer fills its ring live.
- **One glance beats a list.** The board puts every field on one screen — no
  scrolling — grouped the way the rings are, and sized to what each field *is*: a
  yes/no is one small box, a gauge earns two. Rings cap at 100% each, so a strong
  area can never hide a neglected one.
- **The day, and the week.** The left third carries the rings, today's three
  categories as bars, and a Monday-to-Sunday strip with one bar per day — so a
  single glance answers "how is today" and "how is the week" at once.
- **A shape per field.** A yes/no is drawn as a switch, a band to land in as a
  band, a count you stack as blocks, a ceiling you stay under as a line you keep
  left of. The chart is decided by the data, never by taste.
- **Room to grow, never failure.** No streaks-on-fire, no red screens. Bad days
  are framed as the next thing to try.
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
  css/board.css    the board: bands, tiles, the eight chart shapes, tile states
  js/core/         api client, dom helpers, formatting, motion, haptics
  js/rings.js      the ring renderer used by every page
  js/components/   tile.js (one tile per shape), quickLog.js, sheet, toast
  js/views/        one small module per page
```

Everything is hand-written ES modules — no build step, no npm, no framework.

Adding a field means editing `metrics.py` once: the field, the shape it reads
best in, and the two cells it occupies on the board.

## Cloudflare-free, analytics-free, yours

Self-hosted, single process, one SQLite file. Back it up by copying it.

## Status

v2.1.1 — the whole loop works end to end, the whole day fits one screen without
stretching to fill it, every field is drawn in the shape its data deserves and
sized to what it holds, and the week is visible from the home screen. Next:
[v2.2](v2.2.md), answering on the board itself.
