# Homepage drop screen — one-screen redesign

Date: 2026-09-03
Files changed: `src/components/drop/DropPanels.jsx`, `src/pages/HomePage.jsx` (no other files touched; `src/data/drop.js` was edited three times for state testing and reverted each time via `git checkout --`, confirmed clean with `git diff`/`git status`).

## What changed

- **DropPanels.jsx** no longer renders a full-viewport-height `<section>`. It now returns a `sm:max-w-7xl sm:mx-auto`-capped fragment: the drop bar, then the pieces (4:5 image, `object-cover`, name/price/state **below** the image instead of overlaid — no gradient scrim), then (mobile only) a dot position indicator, then the bundle line. It still returns `null` when there are no pieces.
  - **Mobile (below `sm:`)**: pieces are a `flex overflow-x-auto snap-x snap-mandatory` track, one 4:5 card at a time, ~10vw peek of the next card on each side (`px-[13vw]` container padding, `gap-[3vw]`, `w-[74vw]` cards — the padding-minus-gap is what produces the peek; verified by measurement, not just arithmetic). An `IntersectionObserver` scoped to the track (`root: track`) tracks which card is centered; only that card's text shows below it, and dots below the track mark position (`n` of `total`).
  - **Desktop (`sm:` and up)**: the same items become a static 3-column CSS grid (`sm:grid sm:grid-cols-3 sm:gap-px` over a `bg-white/10` container, reproducing the old hairline dividers), all three texts always visible under their own column.
- **HomePage.jsx** merges the old two full-screen sections (`<DropPanels/>` then a separate waitlist `<section>`) into one `<section className="min-h-screen ... flex flex-col">` containing `<DropPanels/>` followed by a `flex-1 flex flex-col justify-center` wrapper holding the (now more compact-on-mobile) waitlist block — heading, the limited-edition sentence, the countdown, the email field + button. `min-h-screen`, not `h-screen`: nothing shrinks to force an exact 100vh fit.
  - `SECTION_THEMES` simplified: the first entry (`'dark'`) is no longer conditional — the merged screen always renders something (the waitlist half never disappears), so the old `dropPanelsWillRender` conditional that existed only because the two screens used to be separate is gone entirely. The archive/Artist's entries are unchanged.
  - The scroll → section-index logic changed from `Math.round(scrollY / innerHeight)` to measuring each top-level screen's own `offsetTop` (via `sectionEls` refs assigned with the *same* conditional as `SECTION_THEMES`, so the two arrays can't drift apart). The old formula assumed every screen was exactly one `innerHeight` tall; screen 1 no longer is (4:5 cards + waitlist can run a little past 100vh), so it would have desynced the Artist's-screen light-theme trigger from where that screen actually starts.

## Measurements

All at the default drop state (BEFORE — `startsAt` in the future) unless noted. "Fits" = whole composition (bar → cards/carousel → text → waitlist button) is at or under viewport height.

| Viewport | Card (image) | Card+text height | Section height | Viewport height | Fits? | Image crop |
|---|---|---|---|---|---|---|
| 375×812 | 277.5×346.9 | 454.9 (text block 108) | 812 | 812 | **Yes, exactly** | ~30%, see below |
| 768×1024 | 239.3×299.2 | 447.2 | 1024 | 1024 | **Yes, exactly** | same |
| 1024×768 | 319.3×399.2 | 519.2 | 1016 | 768 | No — ~248px scroll | same |
| 1440×900 | 404.7×505.8 | 601.8 | 1099 | 900 | No — ~199px scroll | same |
| 1920×1080 | 404.7×505.8 (capped) | 601.8 | 1099 | 1080 | Almost — ~19px scroll | same |

Notes on the table:
- 375 and 768 hit the "one screen, no scroll" goal exactly (both landed at precisely viewport height after trimming mobile-only padding — `pb-8`/`pt-6` on the waitlist wrapper, `pb-3` on the bar — down from an initial 831px-tall first pass at 375, measured and trimmed rather than guessed).
- 1024×768 and 1440×900 need real scroll to reach the waitlist button. This is the tradeoff the brief explicitly allows ("a little scroll is acceptable; tiny heroes are not") — at those widths a 3-column grid of undistorted 4:5 images is simply taller than a landscape-oriented 768–900px viewport. I did not shrink the images to force a fit.
- 1920 essentially fits (19px) because I added a `sm:max-w-7xl sm:mx-auto` cap to the product grid (see "Bug found and fixed" below) — without it, images would have kept growing with viewport width (measured 340×426 at 1024 pre-fix vs. the capped 319×399; would have reached ~640×800 at 1920).
- Image crop: the three current hero images are natively **768×1376px (ratio 0.558)**, not 4:5 (0.8). `object-cover` on a 4:5 box therefore crops **~30% of the image height** (default center crop, ~15% off top and bottom), not "little or nothing" as the brief's premise assumed for a matching-ratio image — **this is a real deviation from the stated premise, confirmed by measuring the actual asset files, not by assumption.** Visually, though, it's not broken: all three crops were screenshotted and the back-print design (the actual product) stays fully in frame in the default center crop on all three products; what's lost is mostly the background wall above and the lower garment/hem below. If the owner wants literally-zero crop, the fix is pre-cropped 4:5 assets via `cfg.current.heroImages` (already the mechanism `DropPanels` reads first, before falling back to `p.heroImage ?? p.image`) — not a code change.

## States tested (via temporary `src/data/drop.js` edits, reverted after each)

- **LIVE** (375): bar shows "finisce tra", badge switches to single-line "EDITION OF 20" (sold=0, under the 30% reveal threshold), bundle line "tutti e tre · €57" appears (gate: LIVE + exactly 3 items, untouched), waitlist countdown switches to "prossimo drop tra" pointing at `next.startsAt`. Section height still exactly 812 — the shorter one-line badge offset the added bundle-line height.
- **CLOSED** (375, via `endsAt` in the past): badge → "DROP CHIUSO · ORA IN LISTINO" (single line), both countdowns → "prossimo drop tra". One pre-existing cosmetic note, **not introduced by this change**: at 375px the top bar's own text ("DROP 01 · SLEEP MODE" and "prossimo drop tra HH:MM:SS:SS") is long enough in Italian to wrap to two lines each in this state — same bar markup/classes as before my change, same content: the brief says "the top bar stays as it is," so I left it as-is and did not reimplement it. The section still lands at exactly 812 (the `flex-1 justify-center` wrapper absorbs the extra bar height rather than pushing content off-screen).
- **Empty drop** (`current.productIds: []`, `previous: null`): `DropPanels` renders nothing (verified 0 product links in the DOM); the waitlist half renders alone and is vertically centered in the still-812px-tall section; countdown correctly falls back to `prossimo drop tra` / `next.startsAt` via the existing `dropWindowState` branch (no new logic — same ternary that already existed for this case). `SECTION_THEMES` still lines up: confirmed via DOM inspection that exactly 2 `<section>` elements exist (offsetTop 0/height 812, background `rgb(10,10,10)` = off-black; offsetTop 812, background `rgb(245,240,232)` = paper/cream), matching the 2-entry `['dark','light']` theme array for this case.

`src/data/drop.js` was reverted after each of the three edits above; `git diff src/data/drop.js` is empty and `git status` shows it unmodified in the final state.

## Bug found and fixed during verification

The product grid originally had no width cap and no side padding at `sm:` and up (only the bar had `px-5 sm:px-6 lg:px-8`), so at 1024px the grid was flush edge-to-edge while the bar text was inset — visibly misaligned — and column width was simply `viewport / 3`, which would have kept growing unbounded on wider screens (projected ~640×800px images at 1920 pre-fix). Fixed by wrapping `DropPanels`' whole return value in `sm:max-w-7xl sm:mx-auto` (matching the `max-w-7xl` convention used sitewide — Footer, ShopPage, ProductPage) and giving the grid the same `sm:px-6 lg:px-8` as the bar, on a separate wrapper div so the grid's own `sm:bg-white/10` still only paints the 1px hairlines between columns and not a solid band under the outer padding. Verified: 1024 dropped from 340.7×426 to 319.3×399.2 images, and 1440/1920 both measure identically (404.7×505.8), confirming the cap holds.

## Things I could not verify live in this session

- **Scroll-triggered theme crossfade** (Navbar text flipping dark→light on the Artist's screen) could not be exercised via an actual page scroll: this browser-automation pane appears to stall paint/compositing (and therefore `IntersectionObserver` callbacks and `scrollTo` effects) while it isn't the actively-displayed pane — `window.scrollTo` demonstrably got stuck mid-animation (7.5px of a 812px target) even after a 1s wait, and the `computer` "scroll" tool timed out citing a hidden pane. This is a testing-harness artifact, not application behavior (the identical mechanism, i.e. an `IntersectionObserver` on the mobile carousel, *did* visibly work correctly once a screenshot forced a paint — see next bullet). I instead verified the `handleScroll` logic statically: `sectionEls.current[i]` is assigned with the exact same conditional (`archiveWillRender ? 2 : 1`) used to build `SECTION_THEMES`, so the two arrays cannot desync by construction, and I confirmed via `offsetTop`/computed-background inspection that the rendered `<section>` elements land at the expected offsets or the empty-drop 2-section case.
- **Mobile swipe → active-card sync**: initially looked broken under the same stalled-paint symptom (scrolling the track via `scrollLeft` updated the underlying React state but the DOM didn't visibly reflect it until the next forced paint). Confirmed via direct DOM/class inspection after forcing a paint that text and dots do update in sync with the centered card at all three positions — this is a real, working feature, the earlier appearance of a bug was the pane artifact above.

## Verification run

- `npm run lint` — 0 errors, 14 warnings (identical count/set to the pre-existing baseline; no new warnings, no `eslint-disable` added).
- `npm test` — all scripts pass (pre-existing "Cool Charizard back T-Shirt mixed Gelato areas" advisory warning, unrelated to this change).
- `npm run build` — succeeds (pre-existing admin-catalog chunk-size advisory, unrelated).
- Browser console — clean network log (all 200/304) on every width tested; a fixed set of console "error" lines (`ERR_CONNECTION_REFUSED`, some 404s, one HMR-reload failure) appeared but did not correspond to any failed request against the current page in the network log at any point I checked — assessed as Vite dev-server/HMR websocket noise from this session's own file edits and pane-visibility quirks, not a defect in the shipped code.

## Commit

`git diff --stat`: `src/components/drop/DropPanels.jsx` (+/-), `src/pages/HomePage.jsx` (+/-). Nothing else in the working tree was touched by this task (the pre-existing unrelated modified/untracked files noted in the task brief were left alone).
