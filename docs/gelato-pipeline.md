# Gelato print pipeline

Source of truth for how JAYL products get print files and mockups. Rules that previously lived only in Joshua's head — keep this updated when conventions change.

## Print files
- **Canvas: 3661×4843 px** (both placements).
- **Front print → placement `default`.** Standard Gelato front placement is a 3:4 area centered on the chest; JAYL front designs often use a small logo **top-right** — do not blindly center artwork. When in doubt, ask which layout the design uses before generating the file.
- **Back print → placement `back`.** Every back-print product MUST have this file or the product is not buyable (see the f50cb3b incident: 8 products shipped unbuyable).
- Print files must be uploaded via the admin (`upload-design`) so they are committed to the repo and referenced by the product — having the design "already on Gelato" is not enough; the store needs its own copy for order submission.

## Mockups
- Imported per product via admin action `import-gelato-images` (Gelato-generated default mockups per color). These default Gelato images are important — do not remove them when adding custom shots.
- Import is currently one commit per run — check existing product images first (idempotency) to avoid duplicate batches.
- Gelato API fetching has been flaky historically (WebFetch failures) — if an import returns empty, retry once, then check the Gelato dashboard manually rather than looping.

## Known gaps / TODO
- TODO: script that diffs products in `src/data/admin-products.js` against their print files and reports missing front/back files (pre-publish gate, could run in prebuild or as an admin action).
- TODO: batch mockup import for all colors as a single GitHub tree commit (Git Data API) instead of N Contents-API PUTs.
- TODO: document the exact Gelato product/variant UID mapping used in orders (read `api/orders.js` when doing this).
