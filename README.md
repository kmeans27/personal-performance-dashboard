# Pulse

**A personal performance dashboard.** Log the handful of things that actually
matter, once a day, in under thirty seconds — then read the whole day at a
glance: four rings (Body, Mind, Attention, People) around one score.

Not a habit tracker. An instrument.

```
   ╭───────────────╮      BODY               MIND
   │  ╭─────────╮  │      ▌sleep   ──────     ▌deep blocks ──
   │  │ ╭─────╮ │  │      ▌steps    ▌gym      ▌learned  ▌read
   │  │ │ 82  │ │  │      ▌alcohol  ▌greens   ▌mood     ▌energy
   │  │ ╰─────╯ │  │  ──────────────────────────────────────────
   │  ╰─────────╯  │      ATTENTION            PEOPLE
   ╰───────────────╯      ▌screen time ──       ▌real connection ──
     MONDAY 19 OCT        ▌pickups  ▌stay clean
     5 of 14 logged
```

## Why it exists

- **Logging is the point.** One field per screen, sized to the field type,
  prefilled with yesterday's value. Each answer fills its ring live.
- **One glance beats a list.** The board puts every field on one screen — no
  scrolling — sized by how much each one matters, and grouped the way the rings
  are. Rings cap at 100% each, so a strong area can never hide a neglected one.
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
  Pulse — One glance. Four rings. One score.
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
| `/`         | Today: the board — every field on one screen, tap to log in place |
| `/log`      | The logging flow — one field per screen, live ring feedback       |
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
  css/board.css    the board: bands, tiles, chart types, tile states
  js/core/         api client, dom helpers, formatting, motion, haptics
  js/rings.js      the ring renderer used by every page
  js/components/   tile.js (one tile per chart type), quickLog.js, sheet, toast
  js/views/        one small module per page
```

Everything is hand-written ES modules — no build step, no npm, no framework.

## Cloudflare-free, analytics-free, yours

Self-hosted, single process, one SQLite file. Back it up by copying it.

## Status

v0.2.0 — the whole loop works end to end, and the whole day fits one screen:
log, score, review, learn, from the couch.
