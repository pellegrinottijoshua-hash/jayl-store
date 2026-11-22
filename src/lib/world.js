// Due mondi nello stesso negozio.
//
// - "zack": Zack the Duck. E' la facciata di jayl.store: home "/", le sue
//   schede, header e footer suoi. Mai Pokémon qui dentro.
// - "jayl": il negozio JAYL di prima (drop, NEW, fan art), con la home
//   spostata su /jayl. Ci si entra dalla "porta" nell'hamburger e nel footer.
//
// Il mondo si legge dall'indirizzo e, per le schede, dal prodotto
// (section 'zack'). Le pagine neutre (checkout, carrello, legali) restano
// nel mondo da cui si arriva: lo ricorda sessionStorage.

export const ZACK = 'zack'
export const JAYL = 'jayl'

// ── Due domini, un solo progetto Vercel ─────────────────────────────────
// zacktheduck.com = solo Zack (home "/"), jayl.store = solo JAYL (home "/").
// I salti tra i due li fa vercel.json (redirect per host) e, per la
// navigazione dentro l'app, i link assoluti qui sotto. Altrove (localhost,
// anteprime *.vercel.app) resta il sito unico di prima: Zack su "/", JAYL
// su /jayl, cosi' si prova tutto da un indirizzo solo.
export const ZACK_ORIGIN = 'https://zacktheduck.com'
export const JAYL_ORIGIN = 'https://jayl.store'

const HOST = typeof window !== 'undefined' ? window.location.hostname : ''
/** 'zack' | 'jayl' | null (null = sito unico, dev e anteprime) */
export const SITE = /(^|\.)zacktheduck\.com$/.test(HOST) ? 'zack'
  : /(^|\.)jayl\.store$/.test(HOST) ? 'jayl'
  // In locale si prova un dominio con VITE_SITE=zack|jayl npm run dev.
  : (import.meta.env?.DEV && ['zack', 'jayl'].includes(import.meta.env.VITE_SITE)) ? import.meta.env.VITE_SITE
  : null

export const ZACK_SECTION    = 'zack'
export const ZACK_COLLECTION = 'Zack the Duck'
// La home dei due mondi, vista da dove si e'. Link assoluto = altro dominio
// (react-router lo apre come pagina nuova).
export const JAYL_HOME = SITE === 'zack' ? `${JAYL_ORIGIN}/` : SITE === 'jayl' ? '/' : '/jayl'
export const ZACK_HOME = SITE === 'jayl' ? `${ZACK_ORIGIN}/` : '/'
// "Continua a comprare" dalle pagine neutre (cassa, conferma): su zacktheduck.com
// e' la home di Zack, altrimenti lo shop JAYL di sempre.
export const SHOP_HOME = SITE === 'zack' ? '/' : '/art'
export const isExternal = (href) => /^https?:\/\//.test(href)

/**
 * Se `pathname` appartiene all'altro dominio, l'URL assoluto dove portarlo;
 * altrimenti null. Le pagine neutre (checkout, legali…) restano dove sono.
 */
export function crossSiteUrl(pathname, search, findProduct) {
  if (!SITE || pathname.startsWith('/admin')) return null
  let w = null
  if (pathname === '/') return null
  if (pathname === '/zack' || pathname.startsWith('/zack/') || pathname.startsWith('/collection/zack')) w = ZACK
  else if (pathname.startsWith('/product/')) {
    const p = findProduct?.(decodeURIComponent(pathname.split('/')[2] || ''))
    if (p) w = isZackProduct(p) ? ZACK : JAYL
  } else if (!NEUTRAL.test(pathname)) w = JAYL
  if (!w || w === SITE) return null
  const path = pathname === '/jayl' || pathname === '/zack' ? '/' : pathname
  return (w === ZACK ? ZACK_ORIGIN : JAYL_ORIGIN) + path + (search || '')
}

// Palette Zack: nero, panna, oro. Colori fissi e non i token del sito: il
// tema panna/nero di JAYL non deve toccare il mondo di Zack.
export const Z = { black: '#111111', cream: '#F5F0E8', gold: '#C4A35A' }

export const ZACK_SOCIAL = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/zack_theduck/' },
  { key: 'youtube',   label: 'YouTube',   href: 'https://www.youtube.com/@zack_theduck' },
  { key: 'tiktok',    label: 'TikTok',    href: 'https://www.tiktok.com/@zack.theduck' },
]

export const isZackProduct = (p) => p?.section === ZACK_SECTION

/** L'URL pubblico di una scheda, sul dominio del suo mondo (admin, condivisioni). */
export const publicProductUrl = (id) =>
  `${/^zack-/.test(String(id || '')) ? ZACK_ORIGIN : JAYL_ORIGIN}/product/${id || ''}`

// Pagine che non appartengono a nessuno dei due mondi.
const NEUTRAL = /^\/(checkout|order-confirmation|wishlist|track|contact|shipping|returns|terms|privacy|cookies)(\/|$)/

const KEY = 'jayl-world'
const remember = (w) => { try { sessionStorage.setItem(KEY, w) } catch { /* private mode */ } }
const recall = () => { try { return sessionStorage.getItem(KEY) } catch { return null } }

/**
 * Il mondo per questo indirizzo. `findProduct` risolve /product/:id.
 * Ricorda l'ultimo mondo "vero" per le pagine neutre.
 */
export function worldFor(pathname, findProduct) {
  // Sui domini veri il mondo e' il dominio: niente da indovinare.
  if (SITE) return SITE
  let w = null
  if (pathname === '/' || pathname.startsWith('/zack')) w = ZACK
  else if (pathname.startsWith('/product/')) {
    const id = decodeURIComponent(pathname.split('/')[2] || '')
    w = isZackProduct(findProduct?.(id)) ? ZACK : JAYL
  } else if (pathname.startsWith('/collection/zack')) w = ZACK
  else if (!NEUTRAL.test(pathname)) w = JAYL

  if (w) { remember(w); return w }
  return recall() === JAYL ? JAYL : ZACK
}
