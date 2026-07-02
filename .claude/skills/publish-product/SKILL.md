---
name: publish-product
description: End-to-end checklist to publish (or fix) a product on jayl.store — mockups, print files, SEO, Pinterest, sitemap — as ONE consolidated pass instead of dozens of ad-hoc commits. Use when adding a new product, when a product is "not buyable", or when the user asks to publish/update product listings in batch.
---

# Publish Product

Historically 97% of commits were machine-shaped one-offs ("admin: import gelato mockup …" × 52, "admin: update <slug>" × 45), with duplicate mockup batches and products shipped without back print files (→ unbuyable, fixed after the fact). This skill turns that into one idempotent pass per product.

All admin actions go through `POST /api/admin` with `{ action, password, ...data }` (password: env `ADMIN_PASSWORD` — ask the user, never hardcode). Key actions: `read-product`, `save-product`, `import-gelato-images`, `upload-design`, `generate-seo`, `generate-copy`, `update-product-images`, `set-featured`, `publish-social-asset`.

## Checklist (per product)

1. **Load state.** `read-product` (or read `src/data/admin-products.js` locally) — note existing images, print files, SEO fields, Pinterest state. Everything below must be **idempotent: skip steps whose output already exists** (the duplicate psyduck mockup batch happened because nobody checked).

2. **Mockups — all colors in one batch.** `import-gelato-images` for the product; verify every color variant got its mockups. MANUAL / TODO-automate: batching N colors into a single GitHub commit (today each import commits separately — prefer running imports back-to-back, then a single `/sync-main`).

3. **Print files — completeness gate.** A product is buyable only if it has:
   - front design at placement `default`, canvas **3661×4843 px**
   - back design at placement `back` (if the product has a back print), same canvas
   Check `docs/gelato-pipeline.md` for placement rules. If a file is missing, STOP and report before publishing — do not ship an unbuyable product.

4. **SEO.** `generate-seo` (gpt-4o-mini with anti-repetition rules). Review output for repeated phrasing across products — regenerate if the title/tags overlap an existing listing (Etsy penalizes duplication).

5. **Pinterest.** In the share panel: select pins, publish, confirm the published markers are saved on the product.

6. **Sitemap.** Nothing to do manually — `scripts/generate-sitemap.js` runs in prebuild. Do NOT commit `public/sitemap.xml`.

7. **Sync & ship.** One `/sync-main` pass; if local changes exist, a single commit: `product(<slug>): publish — mockups, print files, seo, pins`.

8. **Verify.** `/verify-live`: product page loads on jayl.store, buy button active, images present.

## Batch mode
For N products, run steps 1–5 for all products first, then a single sync/commit/verify pass. Report a table: product → mockups ✓/✗, front ✓/✗, back ✓/✗, SEO ✓/✗, pins ✓/✗.
