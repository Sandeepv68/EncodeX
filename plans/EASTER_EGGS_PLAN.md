# Seasonal Easter-Egg Logo Plan

Adds a seasonal easter egg to the Dashboard: instead of the default app icon, a
festival-themed logo is shown around seven festivals each year. The logo is
displayed for a centered 7-day window (`festival date ± 3 days`, inclusive) and
automatically reverts to the default icon outside every window.

The logos live in `assets/easter_eggs/` and are only used on the Dashboard
`WelcomeIcon`. No other surfaces, IPC, or packaging changes are involved.

## Semantics

- Window: `festivalDate - 3 days` through `festivalDate + 3 days` (7 days total).
- Variable dates: Easter is computed with the Gregorian computus algorithm;
  Diwali and Holi use a per-year table (2026-2035) that wins when present, and
  otherwise fall back to an astronomical computation (`lunar-calendar.ts`)
  based on a truncated Meeus lunar theory. The fallback is accurate to within
  one day of mainstream panchangs (which themselves vary by a day on lunar
  festivals), so a lunar festival is never silently dropped.
- Overlap: the festival listed first in the config table wins when two windows
  overlap. Config order is the priority order.
- Cross-year edge: windows are evaluated for the surrounding years `Y-1`, `Y`,
  `Y+1`, so the New Year window (Dec 29 - Jan 4) works across the year boundary.

## Festival config (order = priority)

| Festival | Resolution |
| --- | --- |
| Diwali | table (2026-2035), else astronomical fallback |
| Christmas | Dec 25 |
| Easter | computus algorithm |
| Holi | table (2026-2035), else astronomical fallback |
| Halloween | Oct 31 |
| July 4th | Jul 4 |
| New Year | Jan 1 |

### Diwali dates

| Year | Date |
| --- | --- |
| 2026 | Nov 8 |
| 2027 | Oct 29 |
| 2028 | Oct 17 |
| 2029 | Nov 5 |
| 2030 | Oct 26 |
| 2031 | Nov 14 |
| 2032 | Nov 2 |
| 2033 | Oct 22 |
| 2034 | Nov 10 |
| 2035 | Oct 30 |

### Holi dates

| Year | Date |
| --- | --- |
| 2026 | Mar 4 |
| 2027 | Mar 22 |
| 2028 | Mar 11 |
| 2029 | Mar 1 |
| 2030 | Mar 20 |
| 2031 | Mar 9 |
| 2032 | Mar 27 |
| 2033 | Mar 16 |
| 2034 | Mar 5 |
| 2035 | Mar 24 |

## Checkpoints

Status legend: `[ ]` pending, `[x]` done.

- [x] C0. Create this plan document.
- [x] C1. `src/renderer/utils/easter-egg-dates.ts`: `FestivalId`, config table,
  Easter computus, Diwali/Holi tables, and pure `getActiveFestival(date)`.
- [x] C2. `src/renderer/utils/easter-egg-assets.ts`: static logo imports plus
  the default icon, and `resolveDashboardAppIcon(date)`.
- [x] C3. `Dashboard.tsx`: use `resolveDashboardAppIcon` for `WelcomeIcon`,
  remove the commented-out easter-egg imports.
- [x] C4. `src/renderer/utils/__tests__/easter-egg-dates.test.ts`: window
  bounds, cross-year edge, Easter values, Diwali lookup + fallback, overlap,
  no-match.
- [x] C5. Verify: `npx vitest run`, `npx prettier --check`, `npm run build`.
- [x] C6. Lunar fallback: `src/renderer/utils/lunar-calendar.ts` computes
  Diwali (Kartika Amavasya) and Holi (Phalguna Purnima + 1) from a truncated
  Meeus lunar theory, calibrated to the 2026-2035 tables (within one day).
  Wired into `getFestivalDate`; covered by `lunar-calendar.test.ts`.

## Files touched

| Area | File |
| --- | --- |
| Logic | `src/renderer/utils/easter-egg-dates.ts` (new) |
| Logic | `src/renderer/utils/lunar-calendar.ts` (new, lunar fallback) |
| Assets | `src/renderer/utils/easter-egg-assets.ts` (new) |
| Page | `src/renderer/pages/Dashboard.tsx` |
| Tests | `src/renderer/utils/__tests__/easter-egg-dates.test.ts` (new) |
| Tests | `src/renderer/utils/__tests__/lunar-calendar.test.ts` (new) |
| Docs | `docs/EASTER_EGGS_PLAN.md` |

## Verification

- `npx vitest run` (full suite)
- `npx prettier --check "src/**/*.{ts,tsx,json}"`
- `npm run build:renderer` (plus `npm run build` for the full pipeline)
