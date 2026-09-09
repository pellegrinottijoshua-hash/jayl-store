#!/usr/bin/env node
// Riproduce il guasto del 8 settembre 2026: un re-upload del print file di
// Entei (13.8 MB) rifiutato con "This blob already exists" per sempre.
//
// Catena: blobDirectUpload sale il file su un pathname DETERMINISTICO
// (`designs/<id>/<filename>`) → api/admin.js scarica quel blob con
// blobToBase64 e lo cancella SOLO sull'ultima riga del percorso felice → se
// qualunque cosa fra il download e quella riga lancia (e quel giorno il sito
// era a metà del crash del catalogo), il blob resta al suo pathname per
// sempre → ogni retry successivo, stesso filename, stesso pathname, stesso
// 400 rifiutato da Blob perché `allowOverwrite` di default è false.
//
// Due difese indipendenti, entrambe verificate qui:
//   1. api/admin.js chiede allowOverwrite:true nella generazione del token
//      (onBeforeGenerateToken) — un retry con lo stesso pathname sovrascrive
//      invece di scontrarsi. NON più un header sul PUT del client: quello
//      girava come `x-allow-overwrite: 1` fino al 2026-09-09, quando il
//      preflight CORS di blob.vercel-storage.com ha smesso di elencarlo in
//      Access-Control-Allow-Headers e ogni upload dal browser ha iniziato a
//      fallire silenziosamente (xhr.onerror, nessun dettaglio recuperabile —
//      solo la console del browser mostrava il vero motivo). Il permesso ora
//      vive dentro il clientToken firmato, non su una richiesta che un
//      preflight può rifiutare.
//   2. api/admin.js cancella il blob in un `finally`, non più sull'ultima
//      riga del percorso felice — un fallimento a valle del download non
//      lascia comunque un orfano.
//
// Run: node scripts/test-blob-cleanup.js

import { readFileSync } from 'fs'

let passed = 0
const failures = []
const check = (label, cond) => { if (cond) passed++; else failures.push(label) }

// ── 1. Il permesso vive sul token (server), non su un header (client) ──────
{
  const adminSrc = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf-8')
  const tokenFnMatch = adminSrc.match(/onBeforeGenerateToken:\s*async[\s\S]*?\}\)/)
  check('api/admin.js: onBeforeGenerateToken esiste', !!tokenFnMatch)
  check('api/admin.js: onBeforeGenerateToken chiede allowOverwrite:true',
    /allowOverwrite:\s*true/.test(tokenFnMatch ? tokenFnMatch[0] : ''))

  const clientSrc = readFileSync(new URL('../src/lib/blobDirectUpload.js', import.meta.url), 'utf-8')
  check("blobDirectUpload: NON manda più x-allow-overwrite sul PUT (il preflight CORS lo rifiuta)",
    !/setRequestHeader\(\s*['"]x-allow-overwrite['"]/.test(clientSrc))
}

// ── 2. Il cleanup lato server è nel `finally`, non nel percorso felice ─────
{
  const src = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf-8')
  const fnMatch = src.match(/async function blobToBase64[\s\S]*?\n}/)
  check('blobToBase64 esiste in api/admin.js', !!fnMatch)
  const body = fnMatch ? fnMatch[0] : ''
  check('blobToBase64: la chiamata a blobDel vive dentro un blocco finally',
    /finally\s*\{[^}]*blobDel\(/.test(body))
  check('blobToBase64: il download (blobGet) è dentro il try, prima del finally',
    /try\s*\{[^}]*blobGet\(/.test(body))
}

// ── 3. Comportamento: il cleanup avviene sia al successo sia al fallimento ─
// Stessa forma di blobToBase64 — un try che può lanciare in qualunque punto,
// un finally che cancella sempre. Verificato riproducendo la struttura con
// un blobGet e un blobDel finti, non importando il modulo vero: api/admin.js
// legge ADMIN_PASSWORD/env a livello di modulo e non è pensato per essere
// eseguito fuori da una request Vercel.
{
  async function blobToBase64Like(blobGetImpl, blobDelImpl) {
    let deleted = false
    try {
      const result = await blobGetImpl()
      if (result.statusCode !== 200) throw new Error('bad status')
      return 'ok'
    } finally {
      deleted = true
      blobDelImpl()
    }
    // eslint-disable-next-line no-unreachable
    return deleted
  }

  let delCalls = 0
  const del = () => { delCalls++ }

  await blobToBase64Like(async () => ({ statusCode: 200 }), del)
  check('percorso felice: blobDel viene chiamato', delCalls === 1)

  delCalls = 0
  try { await blobToBase64Like(async () => { throw new Error('download fallito') }, del) } catch { /* atteso */ }
  check('download fallito (come quel giorno): blobDel viene chiamato COMUNQUE', delCalls === 1)

  delCalls = 0
  try { await blobToBase64Like(async () => ({ statusCode: 500 }), del) } catch { /* atteso */ }
  check('status non-200: blobDel viene chiamato comunque', delCalls === 1)
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su blob-cleanup:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ blob-cleanup: ${passed} controlli passati`)
