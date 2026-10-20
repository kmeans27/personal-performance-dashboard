# Design pass v2.1.2: home screen rework

Scope: layout and visual design of the Today screen, then the same system on the other screens. No new features. The name in the UI is a placeholder, so don't build visuals around it. The top navigation is a testing aid: leave it.

Goal: a daily dashboard where one glance shows how today is going: what is on target, what is short, what is open.


## Principles

1. **Today-first.** Every card shows today's value against where it should land. No 7-day or history charts on Today (history lives in Calendar, Trends, Insights). Weekly fields (gym, alcohol-free) stay weekly.
2. **The cards are the only inputs.** No second input surface (quick-log lists, duplicate buttons). Everything else is read-only and only navigates: tapping it scrolls to the card and pulses it.
3. **Fill the screen with well-sized instruments, not filler.** No empty card interiors, no decoration.


## Layout (landscape, 16:9)

- Desktop target is landscape: content is wider than tall. It fits 1440 x 900 without scrolling
- **Left rail:** ring and score (with yesterday and usual score as plain numbers), "Next best move" (the most valuable open action with its points, plus a "Show card" button that scrolls to the card but never logs), "This week" (7 mini day rings, week average)
- **Main area:** three category columns (Body, Mind, Attention), each with a header and its score
- **Bottom bar:** "Where your score comes from", one full-width segmented bar, one segment per field sized by weight. Filled = earned, empty = still available, dashed = not logged. Tapping a segment scrolls to its card
- Use CSS grid with fractional columns so everything scales. Test at 1440 x 900, 1920 x 1080 and 2560 x 1440. On large screens scale cards and type up, and cap the width around 1800 px and center it, instead of adding empty space


## Cards

Top row: label and value left, points earned right (e.g. 7/10). Then the instrument, then one gap line in plain words.

Instrument = a scale with the target zone shaded, a marker for today (draggable on sliders), and a faint tick for yesterday (also the suggested value when logging). Gap lines: "1h short of target", "3,000 to go", "9 under your limit".

- Sleep, screen time, pickups: slider/bar with target zone, today marker, yesterday tick
- Steps, outdoor light: progress bar with target tick and "N to go"
- Gym, alcohol-free: weekly dashes, keep the current style
- Deep blocks: large rectangles that fill per block, keep the current style
- Avoid habit (user-defined): 30-day dash row with days clean (a streak, so a longer window is fine)
- **Yes/No fields are their own half-width cards, two side by side** (Greens | Creatine, Read | Learned, Avoid | People). Explicit Yes / No segments, so "No" and "not logged" look different. On Learned, choosing Yes opens a full-width text field below ("What did you learn?")
- States: unlogged = dashed outline; logged = solid; target reached = small check mark in the category hue

Logging is direct manipulation on the card. The guided Log flow uses the same components one at a time and is the main mobile flow.

Fixes: label "Slept" and "In bed" so they don't conflict; gym segments match the target (2); category counters match visible fields; replace cryptic labels ("The daily one", "Stay clean"); the score is provisional while categories are unlogged ("52 so far", missing ring segment dashed).


## Mood and energy

Subjective, in-the-moment ratings: a check-in, not a measurement. 5-step segmented control, not in the score, labeled "Not in the score", no trend chart on Today (a small tick marks the user's usual). Ask "How was today overall?". Trends and correlations live on Insights only, need 4+ weeks of data and are phrased as hints, never causes.


## Visual system

- Background #0A0B0D, card #111317, border rgba(255,255,255,0.06), text #F2F3F5 / #9AA0A6 (starting values, adjust by eye)
- Category hues for rings, dots and thin accents only: Body teal, Mind violet, Attention sky blue, People pink. Amber is reserved for "needs attention" and "next best move" (text, dot or chip, never a card fill). No red, no tinted or gradient card fills
- One typeface, tabular numerals. Values 24-32 px, score 64 px or larger. Labels 13 px, sentence case. Nothing informative under 12 px, contrast at least 4.5:1
- The ring is a luminous object: soft glow in the ring colors, intensity scales with the score. Subtle and slow. No other flourishes (no emoji, confetti, flame streaks)
- Mobile: single column (ring, next best move, categories, breakdown bar), guided Log flow as the main way to log. Verify at 390 px


## Done when

- A first-time viewer can say how today is going and what's the most valuable thing left within 3 seconds
- Every card shows today's value against a target, a gap line and its points. No empty card interiors
- Each field has exactly one way to be logged on the home screen
- Screenshots at 1440 x 900 and 390 px attached
