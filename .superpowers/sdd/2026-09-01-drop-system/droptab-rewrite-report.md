# DropTab hero upload fix + picker simplification + listing-image fix

**Status:** DONE

## Commits
1. `d6ea10a` — fix(admin): DropTab hero upload via Blob, simplify picker to one hero per product
2. `4258287` — fix: use images[0] over flat image on ProductCard and CollectionPage

## 1 — Broken upload, fixed

`DropTab.jsx`'s `ProductHeroPicker` posted a base64 `dataUrl` to `/api/admin` action
`upload-image` (the legacy path `api/admin.js` itself flags as capped by Vercel's 4.5 MB
function body limit). Replaced with the same pattern used elsewhere in the admin:

1. `blobDirectUpload(\`${product.id}/${filename}\`, file, { clientPayload: JSON.stringify({ password: getAdminPassword(), productId: product.id }), onProgress })` — same pathname shape and `clientPayload` as `AdminPage.jsx`'s product-image upload (`doPoolUpload`, ~line 596).
2. On success, `POST /api/admin { action: 'upload-image', productId, filename, blobUrl: blob.url }` — same action, `blobUrl` instead of `dataUrl`.
3. `onSetHero(r.path || r.url)` unchanged (still prefers the relative `/images/<id>/<file>` path api/admin.js returns).

No `dataUrl`/`fileToBase64`/`compressImage` remain in `DropTab.jsx` — grepped after the edit to confirm. Feedback while it runs mirrors `AdminProductPage.jsx`'s `handleUploadDesign`: the upload button's own label switches to `"Upload su Blob (X MB) — NN%"` during the Blob PUT (via `blobDirectUpload`'s `onProgress`), then `"Commit su GitHub…"` while the server writes to the repo; errors surface inline under the control.

`api/admin.js` and `src/lib/blobDirectUpload.js` were not touched — only imported.

## 2 — Picker simplified to one hero per product

Rewrote `ProductHeroPicker` (still in `DropTab.jsx`, same component name). Per product, in a single row:
- A 28×28 preview box showing the *effective* hero — the override if set, else `product.heroImage || product.image` (same fallback `DropPanels.jsx` uses for the live homepage panel) — tagged `HERO` (emerald) or `DEFAULT` (gray) so it's clear at a glance which is showing.
- One "Carica nuovo hero" button (opens the file picker, uploads via the Blob path above).
- "Ripristina default (immagine di catalogo)" — only rendered when an override exists — clears `heroImages[productId]`, same `onSetHero(null)` as before.
- The per-product Cap field is untouched, still in the same row header, still floored at 1 via the existing `setProductCap` (a cap can never be saved as 0 — unchanged validation in `save()`).
- Copy under the preview restates the fallback in the "no hero" case, preserving the original meaning ("...usa l'immagine di catalogo del prodotto (heroImage o image)").

The old per-product grid of 9–14 thumbnails (`product.heroImage`, `product.image`, and every entry in `product.images`, deduped) is gone — that concern (which image is which) belongs to the product editor, per the ask.

Neither `src/data/admin-products.js` nor `src/data/drop.js` was modified.

## 3 — Finished the image inconsistency

Same one-line fix as the prior `ObjectsPage` fix, applied to the two remaining call sites flagged in that phase's report:
- `src/components/product/ProductCard.jsx:39` (feeds ShopPage and WishlistPage) — `src={product.image}` → `src={product.images?.[0] || product.image}`.
- `src/pages/CollectionPage.jsx:140` — same change.

## Verification

- `npm test` — all 6 suites pass (placement, drop, drop-sales, drop-gate, drop-config, drop-orders) plus `check-print-files.js` (40/40 sellable, 1 pre-existing warning unrelated to this change).
- `npm run build` — clean, `prebuild` (incl. `check-api-imports.js` and the same test suites plus sitemap generation) passes.
- `npm run lint` — 0 errors, 14 warnings, identical set/count to the pre-existing backlog (none in the three changed files).
- `node scripts/check-api-imports.js` — 12/12 api entrypoints import cleanly (the three "tolerated" Stripe-key errors are pre-existing/expected in a keyless dev environment, unrelated to this change).

### Browser verification (dev server, `.claude/launch.json` → `jayl-store`, port 5176)

No real admin password used and no real network write made anywhere in this session:
- Bypassed login by setting `sessionStorage.adminAuth = '1'` directly (client-only gate — `AdminPage.jsx` line 4539/4555 — no server call involved).
- Stubbed `window.fetch` for `POST /api/admin {action:'get-drop'}` and `GET /api/drop-status` to return a synthetic drop config built from the three real product ids currently in `src/data/drop.js` (read only, not imported/coupled — this is a throwaway in-page script, not a test file). Everything else (`upload-image`, blob token generation, `list-reviews`, etc.) was routed to a catch-all stub that logs a warning and returns HTTP 599 instead of forwarding to the network — confirmed no other endpoint was hit.
- Screenshotted the "Hero dei pannelli" section with all three products stacked: one with a hero override set (`HERO` tag, "Ripristina default" link present) and two on the default fallback (`DEFAULT` tag, `product.heroImage`/`image` preview, no reset link, explanatory copy shown). Cap field present and working (shows the per-product override "5" on one row, placeholder "default" on the other two).
- Console: only pre-existing 404s for images not present in the local dev `public/images/` tree (unrelated to this change) and framework warnings (React Router future flags) — no errors from `DropTab.jsx` or the upload path.
- For the listing-image fix: seeded `localStorage['jayl-wishlist']` with the same three real product ids and loaded `/wishlist` (renders via `ProductCard`) — all three cards show the styled lifestyle photo (`images[0]`), not the flat mockup. Loaded `/collection/cool-pok-mon` (renders via `CollectionPage`) — same result. Both consistent with the already-fixed `/objects` (`ObjectsPage`).

### Upload call sequence — matches the working AdminPage.jsx pattern

```
ProductHeroPicker.doUpload(file)
  → blobDirectUpload(`${product.id}/${filename}`, file, {
        clientPayload: JSON.stringify({ password: getAdminPassword(), productId: product.id }),
        onProgress,
      })
      → POST /api/admin { type:'blob.generate-client-token', payload:{ pathname, clientPayload, multipart:false } }
      → PUT https://blob.vercel-storage.com/?pathname=<id>/<file>  (Bearer clientToken)
      ← { url, pathname }
  → POST /api/admin { action:'upload-image', password, productId, filename, blobUrl: blob.url }
  ← { ok:true, path, url }
  → onSetHero(path || url)
```

This is structurally identical to `AdminPage.jsx`'s `doPoolUpload` video branch (same pathname shape `${productId}/${filename}`, same `clientPayload` shape) and to `AdminProductPage.jsx`'s `handleUploadDesign` (Blob first, phase/percent feedback, then the corresponding action with `blobUrl`) — just the `upload-image` action instead of `upload-design`, and unconditional (no size-based branch), since hero images are exactly the large-file case Blob exists for. Grepped `DropTab.jsx` post-edit: no occurrence of `dataUrl` remains.

## Notes / concerns

- Left `.claude/settings.local.json` and `mockup-prompts-front.md` untouched (pre-existing modifications, not mine — matches `git status` at the start of the task).
- Did not push, did not touch `api/`, `scripts/`, `vite.config.js`, `src/lib/blobDirectUpload.js`, `src/data/admin-products.js`, or `src/data/drop.js`.
- Did not dispatch subagents.
- One judgment call: the task's Background section frames the "no hero" fallback as "the product's catalogue image," but the code (and its own comments) actually fall back through `heroImage ?? image` — I kept that exact two-step fallback (both in the preview and in the copy), per the task's own instruction to "keep that meaning," since `DropPanels.jsx` on the live homepage panel uses the same `heroImage ?? image` chain and a preview using only `image` would misrepresent what shoppers actually see for products that have a `heroImage` set.
