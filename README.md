# Training OS

A private, phone-first strength-training companion for one athlete. Open it, see today's
workout, log every set in a tap, and know what to progress next.

No build step, no dependencies, no accounts, no network required after the first load.

## Run it

```bash
python3 serve.py 4173
```

Then open `http://localhost:4173` on the phone (same Wi-Fi: use the machine's LAN address)
and add it to the home screen. The service worker caches the whole app on first load, so
after that it opens and works with no connection at all.

Append `?nosw=1` to skip the offline cache while editing the source.

## Tests

```bash
npm test
```

98 tests over the training logic and the logging workflow: the progression benchmark,
rotation ratios, mode structure, plan materialisation, the exercise library's contents and
metadata, migrations and backup recovery, the full set-logging flow, plan edits and their
scope, swaps that preserve performed work, recommendations, past-session correction, the
weekly region ledger with indirect credit and targets, conditioning logging, anchor lifts and block
reviews, per-exercise history, and the colorway contract.

The reasoning behind the split, the movement choices, the volume numbers and the progression rules is in
[PHILOSOPHY.md](PHILOSOPHY.md). What was decided and when is in [DECISIONS.md](DECISIONS.md).

## How it is put together

```
index.html            app shell: four tabs, screen host, sheet/timer/toast roots
sw.js                 offline cache (precached shell, stale-while-revalidate)
styles/app.css        layout, density, controls — identical for every colorway
styles/themes.css     the four colorways (colour, type, radius only — never layout)
src/data/library.js   94 approved exercises with equipment and load conventions
src/data/program.js   weekly plans for physique / strength / athletic
src/core/schedule.js  dates, week index, foundation-vs-variation rotation, plan building
src/core/progression.js  double-progression benchmark, weaker-side logic, trend
src/core/volume.js    region ledger (direct + half-credit indirect), targets, per-exercise history
src/ui/conditioning.js  run / swim logging, kept outside the split
src/ui/blocks.js      anchor lifts, rotating pools, end-of-block review
src/core/store.js     state shape, versioned migrations, save with rotating backup
src/core/actions.js   every mutation: sessions, set logging, swaps, plan edits, corrections
src/ui/*.js           screens, sheets, pickers, rest timer
```

`src/core/*` is pure and DOM-free, which is what the tests drive directly.

## Data safety

- Every change autosaves to `localStorage` (debounced ~200 ms) and flushes on tab hide.
- The previous good snapshot is kept in a separate backup slot; a corrupt primary falls back
  to it automatically and says so.
- Schema changes run through numbered migrations (`migrate()`), so an older snapshot is
  upgraded rather than discarded. Unknown keys are preserved.
- If storage fills, progress photos are dropped so training records are never the casualty.
- Settings → Data and backup exports everything as JSON and restores from a file.
- If the browser blocks storage entirely, the app still runs and says the data will not persist.

## Conventions worth knowing

- **Loads.** Dumbbells are logged per hand, cables and selectorised machines as the stack
  number on that machine, back extensions and dips as bodyweight plus added load.
- **Progression.** Complete every planned set at the top of the rep range and the app offers
  the next load. It never changes a load by itself.
- **Editing.** Changing sets, reps, rest, or swapping a movement always asks whether it is for
  that date only or for the weekly plan from then on.
- **Swaps mid-workout.** Sets already performed stay recorded against the exercise actually
  performed; the new movement picks up the remaining sets.
- **Volume.** The ledger counts regions, not body parts. A set is 1.0 to the region it trains directly and
  0.5 to each region it trains indirectly, measured against editable weekly targets.
- **Conditioning.** Runs and swims are logged on the day they happened and never counted as muscle volume.
- **Trained but not logged.** Any day can be marked as trained without set data, from the workout menu.
  It records that the session happened and contributes nothing to volume or progression, because nothing
  was measured. Reversible, and you can still log it properly afterwards.
- **Anchors vs rotation.** Three lifts per working day stay locked for the six-week block and carry all
  progression tracking; every other slot cycles through a pool, one movement per week. Settings → Anchor
  lifts shows all 18 in one place; Settings → Training block runs the end-of-block review.
