# Training OS — product decision record

Living record of what is settled, what is deliberately out, and what is still open.
Update this file whenever a decision changes, with the date and the reason.

_Last updated: 2026-09-29 (v1.5.0 — UI audit applied: contrast, touch targets, badge density, working load)_

The reasoning behind the programming lives in [PHILOSOPHY.md](PHILOSOPHY.md). This file records *what* was decided; that file records *why*.

---

## 1. Confirmed requirements

| Area | Decision |
| --- | --- |
| Scope | Private, single-athlete, phone-first training companion. Clean build, no shared code or data with anything earlier. |
| Platform | Offline-capable mobile web app / PWA. Vanilla ES modules, no build step, no paid APIs, no network dependency for any core function. |
| Navigation | Exactly four tabs: Today, History, Profile, Settings. No Plan tab; future-plan edits live in workout previews and Settings. |
| Modes | Physique (primary), Strength, Athletic. Structurally different plans, not the same plan at different loads. |
| Training days | Seven. No scheduled rest days. Load is uneven: six working days plus one deliberately light day per mode. |
| Anchors vs rotation | Three anchor lifts per working day, locked for a six-week block, carrying all progression tracking. Every other slot rotates one movement per week from a pool. The light day is all rotation. |
| Blocks | Six weeks by default (editable 4/6/8/12). At the end the app reports each anchor's load movement with a keep-or-swap verdict. Anchors change at reviews, not mid-block — except for pain. |
| Conditioning | Running and swimming are logged only. Never programmed, never part of a session, never counted as muscle volume. |
| Volume ledger | Counts regions (lateral delts apart from front delts, lats apart from upper back, upper chest apart from chest), 1.0 direct and 0.5 indirect, against editable weekly targets. |
| Progression | Benchmark-driven double progression. No RIR, no effort scores, no readiness logging. |
| Load changes | Never automatic. A suggestion is recorded; the athlete taps Accept or Keep current. |
| Unilateral work | Left and right tracked separately; progression judged on the weaker side. |
| Plan edits | Every structural edit asks: this date only, or the weekly plan from now on. |
| Data safety | Autosave, rotating backup snapshot, versioned migrations, export/import, offline writes. |
| Visual design | Restrained native-iPhone utility / gym journal. Three presentation-only colorways. |
| Minimum width | No horizontal overflow at 320 px. |

## 2. Current programming rules

**Physique — 7 days, paired movement patterns.** Each day leads with one compound that drives
progression and adds work for a region that compound left fresh. No two consecutive days lead with the
same pattern.

| Day | Session | Lead pattern | Sets |
| --- | --- | --- | --- |
| Mon | Lats & Biceps | Vertical pull | 21 |
| Tue | Upper Chest & Delts | Incline press | 19 |
| Wed | Quads & Core | Heel-elevated squat | 20 |
| Thu | Upper Back & Triceps | Chest-supported row | 19 |
| Fri | Delts & Upper Chest | Overhead press | 20 |
| Sat | Hinge & Legs | Romanian deadlift | 20 |
| Sun | Priority & Conditioning | *light day* | 15 |

- **Anchors (18, three per working day), chosen by the athlete:**
  hack squat · DB Bulgarian split squat · leg extension (Wed) — trap-bar deadlift · leg press · lying leg
  curl (Sat) — lat pulldown · one-arm DB row · EZ-bar curl (Mon) — incline barbell bench · machine chest
  press · DB lateral raise (Tue) — barbell row · neutral-grip pulldown · EZ-bar skull crusher (Thu) —
  machine shoulder press · incline DB press · cable lateral raise (Fri).
- **No barbell squat variant appears anywhere in the physique plan.** The athlete dislikes squatting;
  the hack squat is the squat pattern, enforced by test.
- **Rotating slots** hold pools of 2–3 movements and advance one per week, so no variation repeats back
  to back. Pools are editable in Settings → Rotating slots.
- **Anchor share of weekly sets:** 59% on working days, 54% including the all-rotation light day.
  Tested to stay in the 55–65% band on working days.
- **Weekly volume delivered:** quads 18, lats 17.7, lateral delts 17.7, upper back 15, upper chest 14 —
  all inside the 14–18 priority band. Full table in PHILOSOPHY.md §6.
- Calves (6) and mid/lower chest (7.3) sit on maintenance by design; neither is a stated priority.

**Strength — 7 days.** Four heavy primaries (squat, bench, deadlift, overhead press) at 3–5 reps with
240–300 s rest, each repeated weekly with no rotation, plus a hypertrophy support day and two light days.
Tested to use lower average reps and longer average rest than physique, and physique is tested to contain
no heavy low-rep primary.

**Athletic — 7 days.** Every day opens with a power quality (jump, throw or sprint) while fresh. Two light
days. Low volume throughout.

**Progression benchmark (all modes).** A load increase is earned when *every* planned set is completed at
or above the top of the assigned rep range. Unilateral work is judged on the weaker side. The suggestion
shows as `Suggestion: 125 lb next time` with Accept / Keep current. Zero-increment movements never
generate one.

**Volume targets.** 14–18 hard sets/week for priority regions, 10–12 for most others, 12–18 for biceps and
triceps because indirect half-credit from the pulls and presses lands there. All editable in Settings.

**Exercise-fit stance.** Proportions (femur 18 in, torso 34 in, tibia 16.5 in, +1.8 in ape index) change
how a lift is set up, not whether it is allowed. Heel-elevated squat is the squat foundation; the back
squat and hack squat rotate in. Incline and machine pressing carry the upper-chest volume because long
arms lengthen every pressing rep. No lift is excluded on proportions alone.

**Waist.** No loaded lateral flexion or weighted rotation is programmed or stocked. Waist appearance is
treated as body composition plus shoulder-to-waist ratio, and the ratio is addressed by delt and lat work.

## 3. Approved exercise library

- 94 movements across 11 muscle groups and 25 movement families, each with accurate equipment and load convention (`total`, `per hand`, `stack`, `bodyweight`, `bodyweight + added`).
- Explicitly included: rope overhead cable triceps extension, single-arm overhead triceps extension, EZ-bar skull crusher, one-arm dumbbell row, machine chest press, EZ-bar curl, dumbbell Bulgarian split squat, 45-degree back extension plus two back-extension variations, cable pull-through, cable pressdowns (bar and rope, logged as machine-specific stack numbers).
- Explicitly excluded, enforced by test: assisted pull-up, machine pullover, pendulum squat, belt squat.
- Custom exercises are available but visually quiet, clearly labelled, and stored separately from the approved library.

## 4. Deferred (good ideas, not built yet)

- Recovery-aware adjustments that suggest without overwriting the plan.
- Smarter baseline calibration from the first two or three sessions.
- A concise weekly review generated only from logged data.
- Per-exercise increment presets beyond the per-movement default.
- Plate maths / bar loading helper.
- Cloud sync. Local storage plus export is the current answer; Settings says so plainly.

## 5. Rejected (deliberately not built)

- Social feeds, leaderboards, sharing.
- Meal or calorie tracking.
- Badges, streaks, gamification, motivational popups.
- Embedded AI chat.
- Automatic program changes without approval.
- Readiness or RIR scoring that adds logging burden.
- A separate Plan tab duplicating what previews and Settings already do.

## 6. Open questions

1. **Body measurements are still empty.** Proportions and tendencies are loaded; girth measurements (chest, arms, waist, thighs, calves) have not been entered. Profile → Body measurements takes them whenever you want a baseline to track against.
2. **One saved fit preference from the previous app is unknown.** The screenshot showed "1 saved fit preference" without naming it. Six sensible preferred movements are seeded; tell me the real one and it goes in.
3. Training days map to weekdays (Mon–Sun as listed above). If a particular session should sit on a different day, that is a one-line change but it is a programming change.
6. Barbell rows (Thu) and trap-bar deadlifts (Sat) are the two lower-back-taxing anchors, two days apart. If Saturday ever feels compromised, cut a set of rows before cutting trap bar. Worth watching over block 1.
4. Units are pounds throughout. A kilogram mode would need a conversion pass over baselines and history.
5. Starting loads are still library estimates, marked *Estimate* until confirmed once. The first two weeks of logging will fix them.

## 7. Change log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-09-29 | Initial build, v1.0.0, schema v3. | First delivery. |
| 2026-09-29 | Rest timer minimises outside the workout instead of hiding. | The spec asks for it to minimise, not disappear; the small pill doubles as a way back into the session. |
| 2026-09-29 | Rendering moved off `requestAnimationFrame`. | rAF is paused in background tabs, which left the app blank when reopened. |
| 2026-09-29 | Athlete proportions, tendencies and physique priorities loaded from the previous app. | Supplied by the athlete. Priorities changed from upper chest / lateral delts / lats / arms / calves to upper chest / lateral delts / lats / upper back / quads. |
| 2026-09-29 | Physique split moved from 5 days + 2 rest to **7 paired-pattern days**. Approved before implementing. | The athlete trains daily. Six working days plus one light day keeps daily training recoverable, and pattern pairing gives each small muscle quality sets instead of leftover sets. Strength and Athletic also moved to seven days. |
| 2026-09-29 | Volume ledger rebuilt around **regions** with half-credit for indirect work, plus editable weekly targets. | "Shoulders: 31 sets" cannot answer a lateral-delt question. Regions match the language the priorities are written in. |
| 2026-09-29 | Conditioning log added (run, swim, bike, row, walk). | The athlete is adding running and swimming. Logged only — kept out of the split and out of muscle volume on purpose. |
| 2026-09-29 | Schema v4 with a migration that reseeds the program, fills blank proportion fields and adopts the new priority defaults only if the old defaults were never edited. | The split change has to reach an existing install without touching logged sessions, baselines, custom exercises or edited preferences. |
| 2026-09-29 | **Anchor / rotating slot model** replaces the old FFV rotation patterns. Approved before implementing. | The athlete wants a fixed set of lifts he can count on and track, plus variety that is explicitly *not* about load. Rotating the foundation itself did both jobs badly. |
| 2026-09-29 | Anchor lifts selected by the athlete: hack squat (not barbell squat), trap-bar deadlift, lat pulldown, incline barbell bench, barbell row, machine shoulder press, DB Bulgarian split squat. | Direct preference, asked and answered. Hack squat because he dislikes squatting; the rest chosen from trackability-vs-stimulus trade-offs presented per option. |
| 2026-09-29 | Six-week blocks with an end-of-block anchor review (progressing / holding / needs review / no data). | He asked for a lock-in period then a scheduled reassessment. Six weeks gives 3–5 load increases per anchor — enough signal to judge the lift rather than the week. |
| 2026-09-29 | Schema v5: block state added, program reseeded for the anchor flag. | Slot shape changed; logged sessions, baselines, custom exercises and single-day edits are untouched. |
| 2026-09-29 | Analog Instrument Panel accent changed from amber `#d8a44f` to steel blue `#5b8fb0`. | Athlete preference. It also fixes a real legibility problem: amber sat too close to the green completion tick. Amber is retained as `--warn`. |
| 2026-09-29 | Fourth colorway **Chalk & Iron** added: near-black, chalk type, square corners, uppercase screen titles, one signal red, no green anywhere. | Athlete choice, for maximum legibility at arm's length under bad gym lighting. Completion ticks fill chalk instead of green, which required a new `--good-ink` token so the check never prints on its own colour. |
| 2026-09-29 | Set-row numerals enlarged 17px → 20px (17px below 340px) and the tick to 19px. | They are the thing actually read mid-set. Verified nothing clips and every tap target stays 44px, including five-column unilateral rows at 320px. |
| 2026-09-29 | Anchor lifts marked with a left rule instead of an "Anchor" badge. | Priority-tagged anchors were carrying two badges and wrapping onto a second line. The rule reads instantly and removes a label from every row. |
| 2026-09-29 | Audit pass: `--faint` raised to clear 4.5:1 on every surface in all four colorways (was 2.98–4.40). | Measured, not eyeballed. It carried the last-performance line, chart axes, weekday labels and inactive tabs — text read at arm's length in bad light. A test now fails if any token drops below AA. |
| 2026-09-29 | Last-performance line moved from `--faint` to `--muted`; touch targets standardised at 44px (`.btn-sm` 36→44, expanded-exercise links 19→44). | Visual weight was inverted against importance, and two touch-target standards existed in one app. |
| 2026-09-29 | Per-row "Priority" badge removed from the workout and the day preview; priorities now appear once as the deduped chip row. | It was showing on five of six rows on leg days, which made it decoration rather than signal. |
| 2026-09-29 | "Foundation movement" renamed to "Anchor lift" in History and the family sheet. | Leftover from the rotation model; the rest of the app had already moved to anchor/rotating. |
| 2026-09-29 | Sessions open at the **working load** — max(baseline, last performed) — and the load picker centres there. | Working above baseline without accepting a suggestion is normal, and the app was proposing a stale number for both the prefill and the one-tap log. A deliberate deload is not dragged back up. |
| 2026-09-29 | Set-volume column dropped from the exercise progression sheet. | Volume falling while load rose read as a contradiction, and its explanation was in the least legible colour on the page. |
| 2026-09-29 | **Mark as trained, no log** added for any date. | A session genuinely happened but was not recorded set by set. The alternatives were both dishonest: reconstruct loads from memory, or let the day read as skipped. This records the fact and nothing else — zero sets, zero volume, zero progression signal — and the day still shows its scheduled plan. Reversible, and a marked day can still be logged properly later without creating a duplicate record. |
