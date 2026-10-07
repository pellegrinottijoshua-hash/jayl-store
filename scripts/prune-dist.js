// Toglie dall'output della build quello che il sito non serve mai, cosi' ogni
// deploy pesa meno sullo spazio Vercel (Hobby: 10 GB per tutti i deploy del
// team; superati, Vercel blocca i deploy nuovi — successo il 07/10).
//
// public/designs/ (~400 MB di file di stampa a 3661x4843) resta nel repo ma non
// serve nel deploy: Gelato, l'admin e le API li leggono da
// raw.githubusercontent.com (printFileUrl, altPrintFileUrl, neckLabelUrl) e li
// scrivono via API GitHub. Vite copia tutto public/ in dist/: qui lo si toglie.
//
// Prima di aggiungere una cartella a TOGLI: verifica che nessuna pagina, API o
// URL salvato la chieda a www.jayl.store (grep su src/, api/ e src/data/).

import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(import.meta.dirname, '..', 'dist')
const TOGLI = ['designs']

const peso = (p) => {
  const st = fs.statSync(p)
  if (!st.isDirectory()) return st.size
  return fs.readdirSync(p).reduce((tot, e) => tot + peso(path.join(p, e)), 0)
}

let tolti = 0
for (const cartella of TOGLI) {
  const p = path.join(dist, cartella)
  if (!fs.existsSync(p)) continue
  tolti += peso(p)
  fs.rmSync(p, { recursive: true, force: true })
}

const resta = fs.existsSync(dist) ? peso(dist) : 0
console.log(`[prune-dist] tolti ${(tolti / 1e6).toFixed(0)} MB (${TOGLI.join(', ')}), il deploy pesa ${(resta / 1e6).toFixed(0)} MB`)
