// Registro dei social della pubblicazione rapida
// (docs/superpowers/specs/2026-09-30-social-publish-design.md).
//
// Condiviso fra l'admin e api/publish-social.js. Aggiungere un social qui lo
// mostra nell'admin in modalità "apri e copia"; per pubblicarlo con un clic
// serve anche il suo adattatore nel server (api/publish-social.js).
//
// `formats`: per ogni formato, i media che il social accetta. L'ordine conta:
// il primo formato compatibile è quello proposto di default.

export const PLATFORMS = [
  { key: 'pinterest', label: 'Pinterest', short: 'P',  color: '#e60023', formats: { pin: ['image'] } },
  { key: 'instagram', label: 'Instagram', short: 'IG', color: '#e1306c', formats: { post: ['image'], reel: ['video'], story: ['image', 'video'] } },
  { key: 'facebook',  label: 'Facebook',  short: 'FB', color: '#1877f2', formats: { post: ['image', 'video'], reel: ['video'], story: ['image', 'video'] } },
  { key: 'x',         label: 'X',         short: 'X',  color: '#e7e7e7', formats: { post: ['image', 'video'] } },
  { key: 'tiktok',    label: 'TikTok',    short: 'TT', color: '#25f4ee', formats: { post: ['video', 'image'] } },
  { key: 'youtube',   label: 'YouTube',   short: 'YT', color: '#ff0033', formats: { short: ['video'] } },
]

export const FORMAT_LABELS = { pin: 'Pin', post: 'Post', reel: 'Reel', story: 'Storia', short: 'Short' }

const SITE = 'https://www.jayl.store'
const enc = encodeURIComponent

export function platformOf(key) {
  return PLATFORMS.find((p) => p.key === key) || null
}

/** I formati di `key` che accettano un media di tipo `mediaType` ('image' | 'video'). */
export function formatsFor(key, mediaType) {
  const p = platformOf(key)
  if (!p) return []
  return Object.entries(p.formats).filter(([, media]) => media.includes(mediaType)).map(([f]) => f)
}

/** Le storie non hanno testo: né Instagram né Facebook lo accettano via API. */
export function usesCaption(format) {
  return format !== 'story'
}

function hashtags(tags, max = 30) {
  const seen = new Set()
  const out = []
  for (const t of tags || []) {
    const h = String(t).replace(/^#/, '').replace(/[^\p{L}\p{N}_]+/gu, '')
    if (!h || seen.has(h.toLowerCase())) continue
    seen.add(h.toLowerCase())
    out.push('#' + h)
    if (out.length >= max) break
  }
  return out.join(' ')
}

function clip(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

/** Il testo da pubblicare (o da incollare) per `key`, dal testo del pool. */
export function composeText(key, caption) {
  const text = String(caption?.text || '').trim()
  const tags = caption?.tags || []
  switch (key) {
    case 'x': {
      // 250 e non 280: il link che X aggiunge conta 23 caratteri.
      const h = hashtags(tags, 3)
      const room = 250 - (h ? h.length + 1 : 0)
      return [clip(text, room), h].filter(Boolean).join(' ')
    }
    case 'tiktok':
      return [text, hashtags(tags, 8)].filter(Boolean).join(' ').slice(0, 2200)
    case 'pinterest':
      return [text, hashtags(tags, 10)].filter(Boolean).join('\n\n').slice(0, 800)
    default:
      return [text, hashtags(tags)].filter(Boolean).join('\n\n')
  }
}

/** Link alla scheda con le UTM: Umami attribuisce la visita al social e al formato. */
export function productLink(productId, key, format) {
  return `${SITE}/product/${productId}?utm_source=${enc(key)}&utm_medium=social&utm_content=${enc(format)}`
}

/** Pagina di pubblicazione dei social senza API collegata ("apri e copia"). */
export function manualUrl(key, { text = '', link = '', media = '' } = {}) {
  switch (key) {
    case 'pinterest': return `https://www.pinterest.com/pin/create/button/?url=${enc(link)}&media=${enc(media)}&description=${enc(text)}`
    case 'facebook':  return `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`
    case 'x':         return `https://x.com/intent/tweet?text=${enc(text)}&url=${enc(link)}`
    case 'instagram': return 'https://www.instagram.com/'
    case 'tiktok':    return 'https://www.tiktok.com/upload'
    case 'youtube':   return 'https://studio.youtube.com/'
    default:          return link
  }
}
