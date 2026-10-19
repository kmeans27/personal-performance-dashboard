# Personal performance dashboard (working title, name TBD)

Logs the most important factors in everyone's life.
With one glance you see what you did well and what could be improved.
Must clearly outclass a simple habit tracker for this exact function.


## Goal

- Log everything once a day and feel satisfied and motivated, with a clear focus on the important parts of life
- Logging is the focus of the project: like a journal, but very time-efficient and satisfying
- It becomes a KPI of your life: you know how it's going and where to improve


## Specifications

- Modern, timeless design (see UI / UX)
- Logging is as fast as possible, around 30 s/day. Some fields suggest an average / yesterday's value where it makes sense (editable, should only take a second)
- Automate what can be automated (sleep, steps, screen time via Apple Health / Health Connect)
- The logging process must be really satisfying, with beautiful animations
- After logging, simply looking at the dashboard should feel rewarding
- How to log each field is carefully considered (slider, counter button, true/false, etc.)
- Weekly fields (gym, alcohol) show progress toward the weekly target, not a daily 0
- Each ring caps at 100%, so one strong area can't hide a neglected one
- Calendar: Apple-style score rings over the calendar; days are clickable to see full performance and all fields
- Trends (positive and negative): the system motivates you to do better and shows where to improve
- Insights: after ~4 weeks of data, show what moves mood/energy (e.g. "on 7h+ sleep days your mood averages higher"), labeled as correlation, not cause
- Demo page: shows how an already logged dashboard looks

(All fields below are open to change.)


## Points system (rings, like Apple Watch)

### 1 Body
- a) Sleep: duration (7-9 h) and regularity of bed/wake time (auto-import)
- b) Steps (auto-import), points capped around 8-10k
- c) Gym sessions per week: target 2-3, at least 2 with resistance training
- d) Weight trend: 7-day average vs. personal goal, optional
- e) Greens & fruits (eaten today, yes/no)
- f) Alcohol-free (week): defaults to yes, log only the days you drink
- g) Outdoor / sunlight: 20+ min, ideally morning light
- h) Creatine: unscored daily reminder, not part of the rings

### 2 Mind
- a) Study sessions / deep blocks (45 min, satisfying counter), capped around 4 per day
- b) Learned something (yes/no; if yes, a field pops up to write down what)
- c) Read 10+ min (checkbox)
- d) Mood / energy (1-5 slider), the outcome used for analysis later

### 3 Attention
- a) Screen time: phone + social media merged into one auto-imported number, weighted lightly
- b) Phone pickups (auto)
- c) Avoid-habit slot, user-defined (default example: no masturbating, yes/no, with days clean in the last 30 days shown instead of a hard streak)

### 4 People
- a) Connected with someone you care about today (yes/no)


## UI / UX (guidance for the implementing agent)

This project is almost entirely UI and UX. It must not look or feel like a generic habit tracker.

**Concept:** an instrument, not a checklist. The home screen is one living composition: concentric rings (Body, Mind, Attention, People) around a single overall score. The area that needs attention most is gently brought forward (a slight pulse plus one plain-language line), so "where to improve" is visible without hunting for it.

**Branding:** the name is a placeholder. The visual identity should come from what the product does (rings, one score, one-glance reading), not from a metaphor built around a name.

**Logging flow:** mobile-first, one-handed, one field per screen, large inputs sized to the field type (slider, tap counter, yes/no swipe), prefilled with yesterday/average. Each answer fills its ring live, so the feedback is the reward. The flow ends with a closing moment: rings settle, one-line insight, done. Target under 30 s.

**Motion:** spring physics, haptics on mobile, 60 fps. Input feedback under 400 ms. One signature moment when a ring closes, and everything else stays quiet. Respect reduced-motion settings.

**Look:** dark-first, calm, high contrast. One accent color per category, one typeface with tabular numerals, generous whitespace. Reference points are Apple Fitness, Oura and Linear, not Duolingo.

**Calendar and trends:** each day is a mini ring set, and tapping opens a day sheet with all fields. Trends read as plain sentences with a small sparkline ("Sleep regularity up 12% vs last month"), not just charts. Bad days are framed as room to grow, never as failure.

**Demo page:** 90 days of believable data with real patterns (weekend dips, a good streak, one rough week).

**Avoid:** checkbox lists, flame-streak badges, confetti, emoji, stock illustrations, guilt notifications, red failure screens.

**Quality bar:** if a screenshot could pass for a template habit tracker, redo it.
