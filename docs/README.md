# Docs

Three things live here.

| Where | What it is |
| ----- | ---------- |
| [Roadmap](ROADMAP.md) | What comes next: v2.3 the phone, v2.4 card settings, v3 the builder, v3.1 the polish. |
| [Versions](versions/README.md) | The full ledger of every release, and the one-page spec for each shipped one. |
| [Notes](notes/) | Background: the original brief, and the design brief behind the v2.1.2 screen. |

Start with the [project README](../README.md) if this is your first visit.

## Reading a version file

Every shipped release from v0.2 on has one file in [versions](versions/), written
the week it shipped and left alone afterwards. Each opens with the same block:

```
**Status: shipped.** `2.2.6`
```

then a paragraph saying what the release changed, then the detail. They are
written to be read on their own — the ledger is the index, not a prerequisite.

## Writing the next one

A release file is written when the release ships, not before; the plan lives in
the [roadmap](ROADMAP.md). When a planned pass changes shape, the roadmap is
edited and the old plan is folded into the pass that supersedes it — the v2.3
undo work now lives inside the phone pass, because that is where it matters.
