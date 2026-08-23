/**
 * scripts/check-api-imports.js
 *
 * Loads every api/*.js entrypoint under plain Node — the way Vercel does — and
 * fails the build if any of them cannot even be imported.
 *
 * Why this exists: api/_lib/catalog.js used to import src/data/products.js, which
 * imports the Vite-only 'virtual:storefront-products' specifier. Vite resolves it
 * for the browser bundle; Node cannot. `npm run build` stayed green because it
 * only ever builds the client, so the breakage shipped and every function that
 * reaches catalog.js — create-payment-intent, webhook, orders, admin — died with
 * ERR_UNSUPPORTED_ESM_URL_SCHEME at module load. Checkout was down and nothing
 * in the build caught it.
 *
 * Only module-resolution failures are fatal. Anything else (a missing API key at
 * construction time, say) is reported but tolerated, so the check still works on
 * a machine with no secrets.
 */
import { readdirSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const apiDir = resolve(__dirname, '../api')

const FATAL = new Set([
  'ERR_UNSUPPORTED_ESM_URL_SCHEME',
  'ERR_MODULE_NOT_FOUND',
  'ERR_UNKNOWN_FILE_EXTENSION',
])

const files = readdirSync(apiDir).filter((f) => f.endsWith('.js'))
const fatal = []
const tolerated = []

for (const file of files) {
  try {
    await import(pathToFileURL(resolve(apiDir, file)).href)
  } catch (err) {
    const line = `${file} — ${err.code || err.name}: ${String(err.message).split('\n')[0]}`
    if (FATAL.has(err.code)) fatal.push(line)
    else tolerated.push(line)
  }
}

for (const t of tolerated) console.warn(`[check-api-imports] tolerated: ${t}`)

if (fatal.length) {
  console.error('\n[check-api-imports] These serverless functions cannot be imported by Node:\n')
  for (const f of fatal) console.error(`  ✗ ${f}`)
  console.error('\nThey would return FUNCTION_INVOCATION_FAILED in production.')
  console.error('Server code must not import Vite-only modules (src/data/products.js,')
  console.error("anything resolved through a plugin, or the '@/' alias).\n")
  process.exit(1)
}

console.log(`[check-api-imports] ${files.length} api entrypoints import cleanly under Node`)
