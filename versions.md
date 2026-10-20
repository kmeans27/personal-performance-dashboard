# Versions

Every release, what it did, and whether it is done. The short version sits at the
top of the [README](README.md); this file is the full ledger.

| Version | Name | Status | What it did |
| ------- | ---- | ------ | ----------- |
| v0.1 | The instrument | ✅ Done | The whole loop: one field per screen, scored rings, weekly fields, trends, insights, a 90-day demo, one SQLite file. |
| [v0.2](v0.2.md) | One screen | ✅ Done | The board as the new home page: every field for today on one non-scrolling screen, sized by importance, tap a tile to log it in place. Phone access over the LAN. |
| [v2.1](v2.1.md) | The UI pass | ✅ Done | Every field is answerable again, one field is retired, and every chart is redrawn in the shape its own data has — no more small circle in a big rectangle. New three-band layout, quieter palette, three rings. |
| [v2.1.1](v2.1.1.md) | The density pass | ✅ Done | Nothing stretches to fill the screen any more: a field is as big as what it holds, three packed columns instead of two loose ones, and the space saved goes to the left third — category bars, a Mon–Sun week strip and three honest numbers. |
| [v2.1.2](v2.1.2.md) | The home screen rework | ✅ Done | One screen of instruments: a rail with ring, score, yesterday, usual, next best move and the week; three category columns; a score bar along the bottom. Every card shows today against its target in one line of plain words, and the cards are the only inputs — the quick-log sheet is gone. |
| [v2.2](v2.2.md) | Log it on the board | ✅ Done (early) | Answer every field where it is read. Shipped inside v2.1.2, because that layout could not be drawn without it. |
| [v2.2.1](v2.2.1.md) | Open it up | ✅ Done | In bed takes one entry — the wake is derived from your sleep — on a 21:00–02:00 axis with your usual window. Every card opens into a detail editor shaped to its field, and the weekly cards let you fix any of the seven days the score counts. |
| [v2.3](v2.3.md) | Undo, and the pointer pass | 🚧 Planned | The safety net for live writes: an Undo toast on every write, 44px hit targets, and a focus audit at every breakpoint. |

## Numbering

The first two releases were numbered `0.1` and `0.2`. From here the release name
*is* the roadmap name, so the package version follows it: v2.1 ships as `2.1.0`
and v2.3 as `2.3.0`. A pass *on* a release keeps its number and adds a patch:
v2.1.2 is the home screen rework on v2.1.1's screen, and v2.2.1 is the detail pass
on v2.2. There was no `1.0` or `2.0` — the roadmap started at two.

v2.2 is the one release with no build of its own: it shipped inside v2.1.2, and
v2.2.1 finished it. The undo work that used to sit under v2.2 became [v2.3](v2.3.md)
— a pass of its own rather than a leftover.

## What lives where

| File | What it is |
| ---- | ---------- |
| [README.md](README.md) | What Pulse is, how to run it, where the code sits. |
| [v0.2.md](v0.2.md) | The board spec, as shipped. |
| [v2.1.md](v2.1.md) | The presentation of every field, and why each chart is the shape it is. |
| [v2.1.1.md](v2.1.1.md) | The density pass: how big each field is, and what fills the left third. |
| [v2.1.2.md](v2.1.2.md) | The home screen rework: the rail, the three columns, every instrument, and the score bar. Also `design-pass-v2.1.2.md`, the brief it answered. |
| [v2.2.md](v2.2.md) | Log it on the board: what shipped early, and where. |
| [v2.2.1.md](v2.2.1.md) | Open it up: the one-entry bed time, the 21:00–02:00 axis, and the detail editor behind every card. |
| [v2.3.md](v2.3.md) | The next release: undo, and the pointer and focus audit. |
| Project-definition-human-nametbd.md | The original brief, kept for reference. |
