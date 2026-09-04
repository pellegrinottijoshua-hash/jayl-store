# jayl.store — project brief (for a fresh Claude Code chat)

Paste-ready context for working on **jayl.store**. Open the new chat with cwd = `~/jayl-store`.

## What it is
**JAYL** — a wearable-art / print-on-demand e-commerce brand ("AI-reinterpreted art movements turned into wearable pieces"). This repo is the **storefront + admin + fulfillment backend**. JAYL is a sub-brand of [pellegrinotti.com](https://pellegrinotti.com) (Joshua Pellegrinotti's personal brand).

## Stack & hosting
- **Frontend:** Vite + React SPA (no Next.js). Output `dist/`. `npm run build` to verify.
- **Backend:** Vercel serverless functions in `api/` (Node). To stay under Hobby's 12-function limit, several handlers are consolidated — e.g. `api/ai.js` is one hub routed via `vercel.json` rewrites (`?handler=listing|etsy-listing|alts|…`).
- **Integrations:** **Gelato** (print-on-demand), **Stripe** (payments), **OpenAI** (`gpt-4o-mini` for SEO copy), Vercel Blob, Pinterest/Facebook (social).
- **Repo:** `github.com/pellegrinottijoshua-hash/jayl-store`. **Vercel project `jayl-store`** → **www.jayl.store**. Auto-deploys on push to `main`.
- **Env:** `.env.local` (Stripe, Gelato `GELATO_API_KEY`/`GELATO_STORE_ID`, `OPENAI_API_KEY`, GitHub token for admin, etc.).

## ⚠️ Critical workflow gotcha
The **admin panel commits directly to the GitHub remote `main`** (via `api/admin.js` using the GitHub API). So your **local clone goes stale fast**. ALWAYS `git fetch origin` + rebase before pushing, and don't trust local data files without fetching first.

## Data model
- **Products:** `src/data/admin-products.js` — `export const adminProducts = ${JSON.stringify(arr, null, 2)}`. Managed by the admin panel; if you edit programmatically, regenerate with that exact serialization to keep diffs clean. Loaded via `src/data/products.js`.
- **Collections:** `src/data/admin-collections.js` (same format). Currently: "Cool Pokémon (front)" + "cool Pokémon (back)". Note accent drift: front products use `collection:"cool Pokèmon"`, back use `"cool pokemon back"`.
- Key product fields: `image` (hero), `images[]` (gallery), `colors[].image` (per-colour mockup), `printFileUrl`, `gelatoProductId`, `variants[].gelatoVariantId`, `collection`, `section`, SEO fields, `gelatoCdnImages`, `excludedGelato`.

## Print pipeline (Gelato v4 orders)
- Artwork = `public/designs/<productId>/design.png`, referenced by `printFileUrl` (raw.githubusercontent URL). Print canvas **3661×4843** (Gildan area).
- Order payload (`api/orders.js`, `api/webhook.js`): `files:[{type,url}]`. **front/chest = `type:'default'`, back-of-garment = `type:'back'`** (back detected by `/back/i` on `product.collection`). A guard refuses to fulfil a back product missing `printFileUrl`.
- Front designs are left-chest-positioned (small, ~27% of canvas); back designs are the character art centred large (~92% width).
- Back-tee source art: `~/Desktop/cool pokemon back/` (6400×6400 transparent PNGs) and `~/Desktop/jayl products/`.

## Gotchas learned this session
- **Gelato standard mockups must be LOCAL committed files** (`public/images/...`). They were once stored as **presigned S3 preview URLs** (`X-Amz-Expires=86400`) that expire after 24h → blank galleries. `gelatoCdnImages`/`imageAlts` may still hold dead S3 URLs but those aren't displayed.
- **Home carousels** (`src/pages/HomePage.jsx`): two independent `<CollectionCarousel>` — back first, then front, split by `/back/i` on collection. "View all" slug is derived from the product's own collection string (CollectionPage matches `collectionSlug(p.collection)`), not the admin collection id.
- **Admin image sequence** (`src/pages/AdminProductPage.jsx`): `MediaPanel` gets the parent's `setSequenza` as the `onReorderSequenza` prop (don't call `setSequenza` directly inside MediaPanel).
- **SEO copy** (`api/ai.js`): listing + Etsy prompts use a per-call randomized `creativeBrief()` + frequency/presence penalties + strict-JSON retry to keep copy distinct. `generate-alts` has a tolerant `extractAltPairs` fallback.

## Recent work (this session)
SEO prompt anti-repetition; alt-text JSON crash fix; split back/front home carousels; back print files (11/13) + `type:'back'` placement; fixed back galleries (expired-S3 → local mockups); fixed admin "remove from sequence" no-op.

## Open items / good next tasks
- `zapdos` and `vileplume` back tees still need source artwork → `printFileUrl` (can't be sold until added).
- Optionally scrub dead S3 URLs from `gelatoCdnImages`/`imageAlts` (cosmetic).
- The expiring-S3 mockup issue could recur on future admin imports — consider always downloading Gelato mockups to `public/images/` at import time.

## Key files
`src/pages/HomePage.jsx`, `src/pages/ProductPage.jsx`, `src/pages/CollectionPage.jsx`, `src/pages/AdminProductPage.jsx`, `src/data/admin-products.js`, `api/ai.js`, `api/orders.js`, `api/webhook.js`, `api/admin.js`, `vercel.json`.
