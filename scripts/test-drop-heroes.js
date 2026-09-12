// Ogni hero referenziato da src/data/drop.js deve esistere davvero.
//
// Perché questo file esiste: un heroImages che punta a un file inesistente
// non rompe niente al build e non lancia a runtime. Il pannello home ricade
// silenziosamente sull'immagine di catalogo e in admin il riquadro
// dell'anteprima resta vuoto — l'unico sintomo è "gli hero non caricano",
// senza un indizio su quale path guardare. Un path sbagliato si scrive in un
// istante (le cartelle dei prodotti hanno nomi lunghi e la cartella non
// coincide sempre con l'id del prodotto: l'hero di `cool-slowpoke-back-t-shirt`
// vive sotto `slowpoke-pok-mon-back-...`), quindi la verifica va fatta qui e
// non a occhio.
//
// Nota su macOS: il filesystem è case-insensitive, Vercel gira su Linux e non
// lo è. Un path con il case sbagliato passerebbe un existsSync e poi darebbe
// 404 in produzione — per questo il confronto è sul nome esatto letto dalla
// directory, non su existsSync.

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/data/drop.js'), 'utf8')

// I path degli hero sono stringhe "/images/<cartella>/<file>" dentro il corpo
// JSON del file. Li leggo dal sorgente invece di importare il modulo: questo
// test deve girare anche se drop.js venisse rifiutato dal parser a valle.
const refs = [...new Set((source.match(/"\/images\/[^"]+"/g) || []).map((s) => s.slice(1, -1)))]

assert.ok(refs.length > 0, 'nessun hero trovato in drop.js — il match è da aggiornare')

const missing = []
const wrongCase = []

for (const ref of refs) {
  const rel = ref.replace(/^\//, '')
  const abs = path.join(root, 'public', rel)
  const dir = path.dirname(abs)
  const base = path.basename(abs)

  if (!fs.existsSync(dir)) { missing.push(`${ref} — manca la cartella`); continue }

  const entries = fs.readdirSync(dir)
  if (entries.includes(base)) continue

  // Il file "esiste" per macOS ma con un case diverso: in produzione è un 404.
  const ci = entries.find((e) => e.toLowerCase() === base.toLowerCase())
  if (ci) wrongCase.push(`${ref} — su disco è "${ci}" (case diverso: 404 su Vercel)`)
  else missing.push(`${ref} — file assente`)
}

if (missing.length || wrongCase.length) {
  console.error('✗ hero del drop non risolvibili:')
  for (const m of [...missing, ...wrongCase]) console.error(`   ${m}`)
  process.exit(1)
}

console.log(`✓ drop heroes: ${refs.length} immagini referenziate, tutte presenti in public/`)
