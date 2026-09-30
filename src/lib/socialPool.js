// Pool dei testi social e storico delle pubblicazioni
// (docs/superpowers/specs/2026-09-30-social-publish-design.md).
//
// Lo stato è quello di src/data/social.json. Funzioni pure: ricevono uno
// stato e ne rendono uno nuovo, mai mutando quello ricevuto — il server
// rilegge il file e riapplica la modifica se GitHub rifiuta la scrittura.

const LOG_MAX = 1000

export function emptySocial() {
  return { version: 1, settings: {}, captions: {}, log: [] }
}

function poolOf(state, productId, platform) {
  return state?.captions?.[productId]?.[platform] || []
}

/**
 * Il primo testo mai usato; con `afterId`, il primo non usato DOPO quello
 * (per "altro testo"), ripartendo dall'inizio in fondo alla lista.
 */
export function nextCaption(state, productId, platform, afterId = null) {
  const pool = poolOf(state, productId, platform)
  const start = afterId ? pool.findIndex((c) => c.id === afterId) + 1 : 0
  for (let i = 0; i < pool.length; i++) {
    const c = pool[(start + i) % pool.length]
    if (!c.usedAt && c.id !== afterId) return c
  }
  return null
}

export function unusedCount(state, productId, platform) {
  return poolOf(state, productId, platform).filter((c) => !c.usedAt).length
}

let seq = 0
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

/** Aggiunge testi nuovi (`{ title, text, tags }`) in fondo al pool. */
export function addCaptions(state, productId, platform, list, now = new Date().toISOString()) {
  const next = structuredClone(state || emptySocial())
  next.captions ??= {}
  next.captions[productId] ??= {}
  const pool = (next.captions[productId][platform] ??= [])
  for (const c of list || []) {
    pool.push({
      id: newId(),
      title: String(c.title || '').trim(),
      text: String(c.text || '').trim(),
      tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
      createdAt: now,
      usedAt: null,
    })
  }
  return next
}

/**
 * Segna il testo come usato (se c'è) e aggiunge una riga allo storico.
 * `entry`: { productId, platform, format, captionId, asset, mode, postId, url }
 */
export function markUsed(state, entry, now = new Date().toISOString()) {
  const next = structuredClone(state || emptySocial())
  const cap = poolOf(next, entry.productId, entry.platform).find((c) => c.id === entry.captionId)
  if (cap) cap.usedAt = now
  next.log = [
    ...(next.log || []),
    {
      at: now,
      productId: entry.productId,
      platform: entry.platform,
      format: entry.format ?? null,
      captionId: entry.captionId ?? null,
      asset: entry.asset ?? null,
      mode: entry.mode ?? null,
      postId: entry.postId ?? null,
      url: entry.url ?? null,
    },
  ].slice(-LOG_MAX)
  return next
}
