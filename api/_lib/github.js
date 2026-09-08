// Helper condivisi per l'API GitHub Contents. Erano duplicati in api/orders.js e
// api/admin.js; api/_lib/drop-sales.js è il terzo consumatore.
const GITHUB_OWNER  = 'pellegrinottijoshua-hash'
const GITHUB_REPO   = 'jayl-store'
const GITHUB_BRANCH = 'main'

const ghHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

/**
 * Legge un file dal repo. Ritorna sempre { content: <base64>, sha, ... }.
 *
 * ── Il limite di 1 MB della Contents API ────────────────────────────────────
 * Sopra 1 MB la Contents API NON restituisce un errore: risponde 200 OK con
 * `encoding: "none"`, `content: ""` e — la parte pericolosa — uno `sha`
 * perfettamente valido. Un chiamante che non controlli `encoding` vede quindi
 * un file esistente, leggibile e vuoto, e uno sha con cui la scrittura
 * successiva va a buon fine.
 *
 * È esattamente ciò che ha distrutto il catalogo l'8 settembre 2026:
 * src/data/admin-products.js ha superato il MB al 43° prodotto (1.060.504
 * byte), readAdminProducts ha letto "catalogo vuoto" con sha valido, e il
 * salvataggio dopo ha riscritto il file con il solo prodotto in corso —
 * quaranta perduti, senza un solo errore da nessuna parte. Non era il
 * salvataggio a essere sbagliato: era la lettura a mentire.
 *
 * Sopra il MB si rilegge quindi lo stesso blob dalla Git Blobs API, che
 * restituisce il contenuto fino a 100 MB. Il fix sta QUI e non nei singoli
 * chiamanti: qualunque file del repo può superare il MB crescendo, e il modo
 * in cui fallisce non lascia tracce da nessuna parte.
 */
export async function ghGet(path, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, { headers: ghHeaders(token) })
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`)
  const file = await res.json()

  // Solo i file: una directory torna un array, e non ha né encoding né sha.
  if (Array.isArray(file) || file?.encoding !== 'none') return file

  const blobRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs/${file.sha}`,
    { headers: ghHeaders(token) },
  )
  if (!blobRes.ok) {
    // Mai ricadere sul `file` con content vuoto: è precisamente il valore che
    // fa scrivere sopra un file integro credendolo vuoto.
    throw new Error(`GitHub GET ${path}: file oltre 1 MB e blob ${file.sha} non leggibile (${blobRes.status})`)
  }
  const blob = await blobRes.json()
  if (blob?.encoding !== 'base64' || typeof blob.content !== 'string') {
    throw new Error(`GitHub GET ${path}: blob ${file.sha} in un encoding inatteso (${blob?.encoding})`)
  }
  return { ...file, content: blob.content, encoding: 'base64' }
}

export async function ghPut(path, content, sha, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${JSON.stringify(err.message || err)}`)
  }
  return res.json()
}
