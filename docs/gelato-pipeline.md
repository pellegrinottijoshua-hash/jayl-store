# Gelato print pipeline

Source of truth for how JAYL products get print files and mockups. Rules that previously lived only in Joshua's head — keep this updated when conventions change.

## Which side prints — do NOT use the collection name
The placement comes from Gelato's own `productUid`, which encodes the print areas:

```
apparel_product_..._gpr_0-4_inlbl_gildan_64000
                        ^^^  gpr_<front>-<back> = print colors per area; 0 = area absent
```

`gpr_4-0` = front only · `gpr_0-4` = back only · `gpr_4-4` = both (ambiguous).

`api/_lib/placement.js` is the single source of truth, shared by `create-payment-intent`,
`orders.js` and `webhook.js`. It falls back to `/back/i` on the collection string only when the
uid cannot decide. **Never reintroduce the collection-name heuristic as the primary signal** —
renaming a collection (e.g. "cool pokemon back" → "Pokemon Built Different") would silently flip
19 back products to the front placement, sending artwork to a print area that does not exist.

## Print files
- **Canvas: 3661×4843 px** (both placements).
- **Front print → placement `default`.** Measured from the files in production:
  art at **35% of canvas width**, left edge at **x 61%**, top at **y 2%**.
  It sits on the RIGHT of the canvas because the canvas is seen from the outside — the wearer's
  left chest is the viewer's right. Centering a front design is the classic mistake.
- **Back print → placement `back`.** Art at **92% of canvas width**, **centered in x**, top at **y 15%**.
- The admin does this fitting automatically (`src/lib/printCanvas.js`): pick the transparent PNG,
  it trims the alpha bounding box, scales and positions per placement, and shows a print preview
  to confirm before committing. Uncheck "Adatta automaticamente" to upload a pre-made file as-is.
- Every product MUST have a print file or it is not buyable (see the f50cb3b incident: 8 products
  shipped unbuyable). `create-payment-intent` now returns 409 for such an item **before** charging
  the customer — previously the money was taken and fulfillment failed afterwards.
- `npm test` (also run in `prebuild`) reports every product missing a print file and every product
  whose variants disagree on the print side.
- Print files must be uploaded via the admin (`upload-design`) so they are committed to the repo and referenced by the product — having the design "already on Gelato" is not enough; the store needs its own copy for order submission.

## Mockups
- Imported per product via admin action `import-gelato-images` (Gelato-generated default mockups per color). These default Gelato images are important — do not remove them when adding custom shots.
- Import is currently one commit per run — check existing product images first (idempotency) to avoid duplicate batches.
- Gelato API fetching has been flaky historically (WebFetch failures) — if an import returns empty, retry once, then check the Gelato dashboard manually rather than looping.

## Known gaps / TODO
- Charizard back has 4 "Light Blue" variants configured as `gpr_4-4` while the other 16 are
  `gpr_0-4`. They still print on the back, but they declare a front area that receives no file —
  verify on the Gelato dashboard whether those orders are accepted.
- TODO: batch mockup import for all colors as a single GitHub tree commit (Git Data API) instead of N Contents-API PUTs.
- TODO: document the exact Gelato product/variant UID mapping used in orders (read `api/orders.js` when doing this).
