# Versions

Every release, what it changed, and whether it is done. The short version sits at
the top of the [project README](../../README.md); the plan for what comes next is
in the [roadmap](../ROADMAP.md).

Each shipped version from v0.2 on has one file, written when it shipped and left
alone afterwards. A row below is the index entry; the file is the story.

## The shape of the project

Pulse has been built in passes, and they stack:

- **0.x — the loop.** Prove the scoring and put every field on one screen.
- **2.1 — the interface.** Give each field the shape its data has, then compress
  it until the whole day fits, then rebuild the home screen around it.
- **2.2 — the editor.** Make the card the place you answer, and the open card the
  place you answer precisely.
- **2.3 — the phone.** Make that same loop the best it can be on glass.
- **2.4 – 3.1 — yours.** Card settings, then the layout builder, then the polish.

If you read only three files: [v2.1](v2.1.md) for why a field looks the way it
does, [v2.2.2](v2.2.2.md) for the editor, and [v2.2.6](v2.2.6.md) for the board
as it is today.

## 2.2 — the editor

| Version | Name | What it changed |
| ------- | ---- | --------------- |
| [v2.2.6](v2.2.6.md) | The ladder you can see | Mood and Energy draw the editor's ladder inside a recessed stage, with visibly filled bars and the chosen step in the accent. The whole instrument is the drag target, the number and unit follow the pointer, the card brightens while held, and a write landing mid-drag cannot move the number. |
| [v2.2.5](v2.2.5.md) | The board answers | The number on a card follows the pointer while a rail is held, and the line of words shows the target until the write lands. Mood and energy draw the editor's ladder, and the answer on a card fills the space the card has. |
| [v2.2.4](v2.2.4.md) | Desktop fill | The columns fill the height they have. A column is a stack of rows, a row is a pair of cards, and every category has its own plan for how tall its rows are: the track thickens, the blocks and chips grow, the clean grid takes its card, and the note under a pair takes its height from the rows around it. |
| [v2.2.3](v2.2.3.md) | Desktop polish | The rail stacks everything it has, including a Sources card that stays only until both imports are live; Main task joins Attention; notes open as a row of their own; mood and energy become one row of chips; the score bar groups by category; and a perfect day gets one quiet moment. |
| [v2.2.2](v2.2.2.md) | The instrument opens | The detail sheet rebuilt around its value: the big number is the input, one sentence of status, and a recessed stage holding the control made for the field — gauge, goal-centred weight scale, five-bar ladder, doors, seven-day mixer, thirty-day grid, night strip. |
| [v2.2.1](v2.2.1.md) | Open it up | In bed takes one entry — the wake is derived from your sleep — on a 21:00–02:00 axis with your usual window. Every card opens into a detail editor, and the weekly cards let you fix any of the seven days the score counts. |
| [v2.2](v2.2.md) | Log it on the board | Every field answered where it is read. Shipped early inside v2.1.2, because that layout could not be drawn without it. |

## 2.1 — the interface

| Version | Name | What it changed |
| ------- | ---- | --------------- |
| [v2.1.2](v2.1.2.md) | The home screen rework | One screen of instruments: a rail with the ring, score, yesterday, usual, next best move and the week; three category columns; a score bar along the bottom. Every card says today against its target in one line, and the cards are the only inputs. |
| [v2.1.1](v2.1.1.md) | The density pass | Nothing stretches to fill the screen: a field is as big as what it holds, in three packed columns, and the space saved goes to the left third — category bars, a Mon–Sun week strip, three numbers. |
| [v2.1](v2.1.md) | The UI pass | Every field is answerable again, one field is retired, and every chart is redrawn in the shape its own data has — no small circle in a big rectangle. Three bands, three rings, a quieter palette. |

## 0.x — the loop

| Version | Name | What it changed |
| ------- | ---- | --------------- |
| [v0.2](v0.2.md) | One screen | The board becomes the home page: every field for today on one non-scrolling screen, sized by importance, tap a tile to log it in place, reachable from a phone over the LAN. |
| v0.1 | The instrument | The whole loop: one field per screen, scored rings, weekly fields, trends, insights, a 90-day demo, one SQLite file. The initial build; its brief is [the original brief](../notes/brief.md). |

## Next

| Version | Name | What it will change |
| ------- | ---- | ------------------- |
| v2.3 | The phone | Mobile logging first — the sheet as the instrument, open fields first, thumb-sized targets, undo — and a dashboard built for a small screen. [Plan](../ROADMAP.md#v23--the-phone). |
| v2.4 | Card settings | Hide, rename, resize and redraw a card from the shapes it already supports, with its targets in one place. [Plan](../ROADMAP.md#v24--card-settings). |
| v3 | The builder | Arrange the grid, keep or drop cards, add fields from a library, with the instrument catalogue public. [Plan](../ROADMAP.md#v3--the-builder). |
| v3.1 | The polish | Make any arrangement — one card or thirty — look deliberate. [Plan](../ROADMAP.md#v31--the-polish). |

## Numbering

The first two releases were numbered `0.1` and `0.2`. From there the release name
*is* the roadmap name, so the package version follows it: v2.1 ships as `2.1.0`
and v2.3 as `2.3.0`. A pass *on* a release keeps its number and adds a patch —
v2.1.2 is the home screen rework on v2.1.1's screen; v2.2.2 is the second pass on
the editor that v2.2.1 opened. There was no `1.0` or `2.0`: the roadmap started at
two.

v2.2 is the one release with no build of its own. It shipped inside v2.1.2, and
v2.2.1 finished it.

The undo work that once sat under v2.2, then under v2.3, now lives in the
[v2.3 phone pass](../ROADMAP.md#v23--the-phone) — it is the same safety net, moved
to the surface where a stray tap actually happens.

## What lives where

| File | What it is |
| ---- | ---------- |
| [../../README.md](../../README.md) | What Pulse is, how to run it, where the code sits. |
| [../ROADMAP.md](../ROADMAP.md) | The next four passes, briefly. |
| [v0.2.md](v0.2.md) | The board spec, as shipped. |
| [v2.1.md](v2.1.md) | The presentation of every field, and why each chart is the shape it is. |
| [v2.1.1.md](v2.1.1.md) | The density pass: how big each field is, and what fills the left third. |
| [v2.1.2.md](v2.1.2.md) | The home screen rework: the rail, the three columns, every instrument, the score bar. |
| [v2.2.md](v2.2.md) | Log it on the board: what shipped early, and where. |
| [v2.2.1.md](v2.2.1.md) | Open it up: the one-entry bed time and the editor behind every card. |
| [v2.2.2.md](v2.2.2.md) | The instrument opens: the rebuilt editor — hero value, status line, a control per field. |
| [v2.2.3.md](v2.2.3.md) | Desktop polish: the rail that stacks, notes on their own row, the grouped score bar. |
| [v2.2.4.md](v2.2.4.md) | Desktop fill: the column that fills the height it has, and the row plan behind it. |
| [v2.2.5.md](v2.2.5.md) | The board answers: the live number under the pointer, and the ladder on Mood and Energy. |
| [v2.2.6.md](v2.2.6.md) | The ladder you can see: the staged meter on Mood and Energy, and the whole instrument as the live drag target. |
| [../notes/brief.md](../notes/brief.md) | The original brief, kept for reference. |
| [../notes/design-pass-v2.1.2.md](../notes/design-pass-v2.1.2.md) | The design brief v2.1.2 answered. |
