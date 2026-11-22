// Solo su Vercel: dist/index.html → dist/app.html.
//
// Vercel serve i file prima delle rewrite, quindi con un index.html la home
// "/" usciva sempre coi meta statici (quelli di Zack) e la regola dei bot in
// vercel.json non scattava mai: l'anteprima social di jayl.store mostrava Zack.
// Senza file su "/" passano le rewrite: i bot vanno al prerender del loro
// dominio, le persone su /app.html (la stessa app). In locale non tocca niente,
// cosi' `vite preview` continua a funzionare.
import { renameSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.env.VERCEL) {
  console.log('[spa-shell] non su Vercel: index.html resta')
  process.exit(0)
}
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const from = resolve(dist, 'index.html')
if (!existsSync(from)) { console.error('[spa-shell] manca dist/index.html'); process.exit(1) }
renameSync(from, resolve(dist, 'app.html'))
console.log('[spa-shell] dist/index.html → dist/app.html')
