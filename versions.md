# Versions

Every release, what it did, and whether it is done. The short version sits at the
top of the [README](README.md); this file is the full ledger.

| Version | Name | Status | What it did |
| ------- | ---- | ------ | ----------- |
| v0.1 | The instrument | ✅ Done | The whole loop: one field per screen, scored rings, weekly fields, trends, insights, a 90-day demo, one SQLite file. |
| [v0.2](v0.2.md) | One screen | ✅ Done | The board as the new home page: every field for today on one non-scrolling screen, sized by importance, tap a tile to log it in place. Phone access over the LAN. |
| [v2.1](v2.1.md) | The UI pass | ✅ Done | Every field is answerable again, one field is retired, and every chart is redrawn in the shape its own data has — no more small circle in a big rectangle. New three-band layout, quieter palette, three rings. |
| [v2.2](v2.2.md) | Log it on the board | 🚧 Planned | Answer directly on the dashboard: drag the slider, tap the counter, flip the switch. No sheet, no second thought. |

## Numbering

The first two releases were numbered `0.1` and `0.2`. From here the release name
*is* the roadmap name, so the package version follows it: v2.1 ships as `2.1.0`
and v2.2 as `2.2.0`. There was no `1.0` or `2.0` — the roadmap started at two.

## What lives where

| File | What it is |
| ---- | ---------- |
| [README.md](README.md) | What Pulse is, how to run it, where the code sits. |
| [v0.2.md](v0.2.md) | The board spec, as shipped. |
| [v2.1.md](v2.1.md) | This release: the presentation of every field, and why each chart is the shape it is. |
| [v2.2.md](v2.2.md) | The next release: answering on the board itself. |
| Project-definition-human-nametbd.md | The original brief, kept for reference. |
