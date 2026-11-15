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

export const ZACK_SECTION    = 'zack'
export const ZACK_COLLECTION = 'Zack the Duck'
export const JAYL_HOME       = '/jayl'

// Palette Zack: nero, panna, oro. Colori fissi e non i token del sito: il
// tema panna/nero di JAYL non deve toccare il mondo di Zack.
export const Z = { black: '#111111', cream: '#F5F0E8', gold: '#C4A35A' }

export const ZACK_SOCIAL = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/zack_theduck/' },
  { key: 'youtube',   label: 'YouTube',   href: 'https://www.youtube.com/@zack_theduck' },
  { key: 'tiktok',    label: 'TikTok',    href: 'https://www.tiktok.com/@zack.theduck' },
]

export const isZackProduct = (p) => p?.section === ZACK_SECTION

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
