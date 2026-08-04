# jayl-store — CLAUDE.md

E-commerce JAYL (jayl.store): print-on-demand t-shirts via Gelato, admin panel at /admin.

## Stack (IMPORTANT: not Next.js)
- **Vite + React SPA** (react-router-dom), Tailwind-style utility classes, framer-motion, zustand.
- **Vercel serverless functions** in `api/` (plain Node handlers). `vercel.json` rewrites ~20 friendly endpoints into a few consolidated handlers (`api/ai.js`, `api/orders.js`, `api/publish-social.js`, `api/admin.js`) to stay under Vercel's function limit — check `vercel.json` before adding a new api file.
- Deploys: push to `main` → Vercel production (jayl.store). No staging.

## Commands
- `npm run dev` — local dev (Vite). API routes need `vercel dev` or the prod URL.
- `npm run build` — prebuild generates `public/sitemap.xml` via `scripts/generate-sitemap.js`. The file is gitignored (regenerated on every build, including on Vercel) — don't hand-edit or re-add it. Collection URLs come from each product's `collection` string — never from the admin collection id, which drifts from it.
- `npm run lint` — ESLint 9 flat config (`eslint.config.js`). Errors block; there is a known backlog of ~45 warnings (dead bindings + `react-hooks/exhaustive-deps`) to burn down. **Don't add new errors, and don't silence a rule to make one go away.**

## CRITICAL git rule
The admin panel writes changes by committing **directly to remote main** via the GitHub Contents API (products, orders, reviews, queue). Local is therefore often behind remote:
- **Always `git pull --rebase --autostash origin main` before pushing.**
- If a push is rejected non-fast-forward or pull complains about unstaged changes → use the `/sync-main` skill.

## Data model
- Products "DB": `src/data/admin-products.js` (~750KB JS module, includes SEO, Pinterest state, print-file refs). Every admin save round-trips this whole file through the GitHub API — avoid concurrent saves.
- Other state: `src/data/*.json` (queue, assets, reviews…).
- `api/admin.js` is a single action-switch endpoint (~40 actions: save-product, generate-seo, import-gelato-images, upload-design, publish-social-asset, verify-password, …).

## Auth (do not regress this)
- The admin password lives ONLY in the Vercel env `ADMIN_PASSWORD`. It must never appear in client code or commits.
- Client flow: login POSTs `{action:'verify-password', password}` to `/api/admin`; on 200 it stores the password in `sessionStorage('jaylAdminPw')`; all API helpers read it via `getAdminPassword()`.
- Cron GET on `/api/admin` requires `Bearer ${CRON_SECRET}` (env set on Vercel; cron runs daily 08:00).

## Gelato print pipeline
- Front print = `default` placement; back print = `back` placement.
- Print canvas: **3661×4843 px**.
- Details and mockup import flow: `docs/gelato-pipeline.md`.

## Env vars
28 vars documented in `.env.example` (Stripe, Gelato, GitHub, Pinterest, Anthropic, fal.ai, Resend…). Server-only; nothing is exposed to the client.

## Workflow skills
- `/sync-main` before any push.
- `/verify-live` after any deploy — never tell the user "deployed" without it.
- `/publish-product` for the end-to-end product publishing checklist.
