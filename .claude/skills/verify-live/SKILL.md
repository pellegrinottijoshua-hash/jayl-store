---
name: verify-live
description: Use after any deploy or push (jayl-store or jayl-studio) to verify production actually shows the change BEFORE telling the user it's done. Checks Vercel build status and the live URL. Also use when the user says "non vedo le modifiche live" or asks whether something deployed.
---

# Verify Live

Never claim "deployed" or "fatto" based on a successful `git push`. A push only starts a build; the build can fail, and the change can be invisible for other reasons (cache, wrong file, wrong selector). Follow all steps.

## Steps

1. **Deployment state.** Run `npx vercel ls 2>&1 | head -8` in the repo. The newest deployment must be `● Ready` and `Production`.
   - If `Building`/`Queued`: poll every ~20s (bounded: max ~8 polls). Do not proceed until Ready.
   - If `Error`: run `npx vercel inspect <deployment-url> --logs 2>&1 | tail -30`, diagnose, fix, redeploy. Report the failure honestly.

2. **Fetch the production URL** (https://jayl.store or https://pellegrinotti.com depending on repo — NOT the *.vercel.app URL, so DNS/alias problems surface too). Verify the specific change:
   - Content/markup change → fetch the HTML and grep for the new markup/text.
   - JS/CSS change → fetch the hashed asset referenced by the live HTML and grep it (the hash must have changed).
   - API change → call the endpoint with a test payload and check status + body (e.g. auth: wrong password → 401, right → 200).
   - Visual change → screenshot via preview/browser tools and compare against the intent.
   - NOTE: shell `curl` may be blocked by hooks — use the ctx_execute tool with a JS `fetch` instead.

3. **jayl-store only — ALWAYS smoke-test the API, whatever you changed.** Not just for "API changes": a build-config or `src/data` edit can kill every function while the HTML and assets look perfect. Run these against production and expect exactly these:

   ```
   POST /api/create-payment-intent  {"items":[]}                          → 400 {"error":"Cart is empty"}
   POST /api/create-order           {"paymentIntentId":"pi_invalid_id"}   → 400 {"error":"Invalid payment intent id"}
   POST /api/admin                  {"action":"verify-password","password":"wrong"} → 401
   POST /api/webhook                {}                                    → 400 missing stripe-signature
   ```

   Use an id **with an underscore** for create-order: the guard is `/^pi_[A-Za-z0-9]+$/`, so
   `pi_fake` passes validation and reaches Stripe, which 500s with "No such payment_intent".
   That is correct behaviour, just a useless signal for a smoke test.

   **A 500 / `FUNCTION_INVOCATION_FAILED` on any of them means checkout is down.** Get the reason with
   `npx vercel logs https://www.jayl.store --json 2>/dev/null | grep -o '"message":"[^"]*'  | tail -5`.

4. **Report with evidence.** State PASS/FAIL plus the concrete proof (status codes, grep counts, screenshot). If FAIL, do not soften it — say what's live vs. what was intended, and fix before ending the turn.

## Failure modes seen historically
- **Checkout dead for 19 days (2026-08-04 → 08-23).** `src/data/products.js` started importing the Vite-only `virtual:storefront-products`; `api/_lib/catalog.js` imports it, and `api/*` runs under plain Node → `ERR_UNSUPPORTED_ESM_URL_SCHEME` at module load, taking down create-payment-intent, webhook, orders and admin. `npm run build` was green the whole time because it only builds the client, and verification only grepped the bundle and the sitemap. **This is why step 3 exists.** `scripts/check-api-imports.js` now blocks the build, but still run step 3.
- "Tu dici che hai deployato ma vercel è solo errors" — build failed after push; nobody checked.
- Change committed to the wrong file (e.g. proto.html vs index.html on jayl-studio).
- Local was behind remote main; push rejected; work never actually left the machine (see /sync-main).
