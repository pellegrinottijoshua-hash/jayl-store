// Risolve quale immagine della gallery corrisponde a quale colore di un
// prodotto — usato dalla pagina prodotto (swatch → foto) e da
// scripts/test-color-image-match.js (lo stesso algoritmo, per validare
// l'intero catalogo prima del deploy invece di scoprire un mismatch guardando
// il sito in produzione).
//
// ── Perché non fidarsi di color.image ────────────────────────────────────────
// `product.colors[].image` è un campo che, oggi, NESSUN percorso del codice
// scrive più: né l'admin panel né `import-gelato-images` lo toccano. È stato
// popolato una volta, alla creazione del prodotto, e da allora si limita a
// invecchiare — ogni reimport dei mockup Gelato genera nuovi filename
// (`{titolo}-{colore}-NN.ext`, vedi `import-gelato-images` in api/admin.js)
// senza mai aggiornare questo campo. Verificato sul catalogo l'8 settembre
// 2026: 126 valori su 243 non corrispondono più a NESSUN file nella gallery
// del prodotto — non "quasi tutti", la maggioranza.
//
// Con `color.image` fuori uso, la vecchia riga di riserva era un
// `img.includes(slug)` — sottostringa pura. Funziona finché i nomi colore non
// si sovrappongono, e su questo catalogo si sovrappongono davvero: "Navy" è
// sottostringa di "Heather Navy", "Red" di "Cardinal Red". Un prodotto con
// entrambi i colori vede il click su "Navy" mostrare la foto di "Heather
// Navy" (o viceversa, a seconda di quale file capita per primo nell'array) —
// esattamente il bug segnalato: "alcuni non matchano quando premi uno o
// l'altro".
//
// ── L'algoritmo: la corrispondenza più specifica vince ───────────────────────
// Per ogni immagine della gallery, fra TUTTI i colori del prodotto il cui slug
// compare nel path, vince quello con lo slug più lungo — "heather-navy" (12
// caratteri) batte "navy" (4) su un file che li contiene entrambi come
// sottostringa. Non serve sapere che "navy" è letteralmente dentro
// "heather-navy": la regola "più lungo vince" risolve la collisione a
// prescindere dalla relazione fra i due slug, quindi generalizza a qualunque
// coppia di nomi colore che si sovrappongano, non solo quelli già noti.
// Ogni immagine finisce assegnata a UN SOLO colore (o a nessuno); un colore
// può avere più immagini.

/** Stessa normalizzazione di ProductPage.jsx / catalog.js — un'unica fonte. */
export function colorToSlug(c) {
  return (c ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Mappa ogni path della gallery al colore che lo "possiede" — o null se
 * nessuno slug colore compare nel path. Pura funzione di `colors` + `images`,
 * niente stato, niente I/O: chiamabile identica dal browser e da Node.
 *
 * @param {Array<{id?:string, label?:string}>} colors
 * @param {string[]} images
 * @returns {Map<string, {id:string,label:string}|null>} path → colore proprietario
 */
export function buildImageOwnership(colors, images) {
  const owners = new Map()
  const entries = (colors || [])
    .map((c) => ({ color: c, slug: colorToSlug(c.label || c.id) }))
    .filter((e) => e.slug)

  for (const img of images || []) {
    const lower = (img || '').toLowerCase()
    let best = null
    for (const e of entries) {
      if (!lower.includes(e.slug)) continue
      // "più lungo vince" — a parità di lunghezza (non dovrebbe capitare con
      // slug distinti, ma non è garantito) resta il primo trovato, deterministico
      // perché `colors` ha sempre lo stesso ordine.
      if (!best || e.slug.length > best.slug.length) best = e
    }
    owners.set(img, best ? best.color : null)
  }
  return owners
}

/**
 * L'indice, in `images`, della prima foto assegnata a `color` — o -1.
 * Usata da ProductPage.jsx per lo scatto "seleziona colore → salta alla foto".
 */
export function findColorImageIndex(color, colors, images) {
  if (!color) return -1
  const owners = buildImageOwnership(colors, images)
  const wantedSlug = colorToSlug(color.label || color.id)
  for (let i = 0; i < (images || []).length; i++) {
    const owner = owners.get(images[i])
    if (owner && colorToSlug(owner.label || owner.id) === wantedSlug) return i
  }
  return -1
}

/**
 * Il colore proprietario di `images[index]` — o null. Usata da
 * ProductPage.jsx per lo scatto inverso "cambia foto in galleria →
 * evidenzia lo swatch corrispondente".
 */
export function findImageColor(index, colors, images) {
  const img = (images || [])[index]
  if (!img) return null
  return buildImageOwnership(colors, images).get(img) || null
}
