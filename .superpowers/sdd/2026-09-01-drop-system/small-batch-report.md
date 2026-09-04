# Small batch — three independent fixes

**Status:** DONE

## Commits
1. `8eac557` — fix(objects): use first image of the sequence, not the flat mockup
2. `ccb7755` — content(artist): replace bio copy with Joshua's own text, add portfolio link
3. `9c4aff9` — fix(checkout): drop-gate rejection said "closed" before the drop opens

## Verification
`npm test` (all 6 suites incl. drop-gate), `npm run build`, `npm run lint` (0 errors, 14 pre-existing warnings, unchanged), and `node scripts/check-api-imports.js` all pass; dev-server screenshots/text-extraction of `/objects` (all three drop products now show the lifestyle shot) and `/artist` (new copy + working `pellegrinotti.com` link, `target="_blank"` + `rel="noopener noreferrer"`) confirmed, console clean in both.

## Report-don't-fix item 1 — other listing surfaces with the same image inconsistency
Same `product.image` (instead of `product.images?.[0]`) bug exists in:
- `src/components/product/ProductCard.jsx:39` — used by **ShopPage** and **WishlistPage** (both render products via `ProductCard`), so both inherit the inconsistency.
- `src/pages/CollectionPage.jsx:140` — same direct `product.image` usage as ObjectsPage had.

Not touched, per instructions — only ObjectsPage was changed.

## Report-don't-fix item 2 — client-side "drop closed" wording
Checked `src/components/drop/*` and `src/pages/ProductPage.jsx`. No client-side bug found: the client already computes a separate before-open state (`dropWindowState.js`'s `BEFORE`) and its own correct label — `ProductPage.jsx:764-765` builds `dropOpensLabel = "Apre il ${date}"` for the pre-open case, distinct from the `"Drop chiuso · ora in listino"` string used only for the genuinely-closed/moved-to-catalog state (`DropPanels.jsx:100`, `ProductPage.jsx:352` etc.). So the wrong "chiuso...il prossimo" wording was server-only, in `create-payment-intent.js`, and is now fixed there. No client changes made.

## Notes
- Did not modify `src/data/admin-products.js` or `src/data/drop.js`.
- Did not touch `.claude/settings.local.json` or `mockup-prompts-front.md` (pre-existing unrelated modifications, left as found).
- Did not push; did not dispatch subagents.
