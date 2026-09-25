import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, shortProductName as shortName } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getDrop, basePriceFor } from '../../api/_lib/drop.js'
import DropHero from '@/components/drop/DropHero'
import SubscribeForm from '@/components/SubscribeForm'
import HomeReviews from '@/components/HomeReviews'

const objectsProducts = products.filter((p) => p.section === 'objects')
const dropCfg          = getDrop()

// L'archivio: i pezzi usciti dai drop chiusi, tornati in listino. `released`
// e' in ordine di rilascio, quindi rovesciato mette in testa l'ultimo drop.
const archiveProducts = (dropCfg.released || [])
  .map((id) => objectsProducts.find((p) => p.id === id))
  .filter(Boolean)
  .reverse()

function FallingS() {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.68em',
        transform: 'rotate(14deg) translateY(0.18em)',
        transformOrigin: 'center bottom',
        opacity: 0.88,
        lineHeight: 1,
      }}
    >
      s
    </span>
  )
}

// L'archivio a tutto schermo: foto a filo, senza margini, una griglia di
// schiene. Le foto lifestyle della collezione sono una serie coerente (stessa
// posa, stessa luce), e a piena larghezza si leggono come una collezione
// invece che come una lista di prodotti.
function ArchiveGrid({ items }) {
  if (!items.length) return null
  return (
    <section data-nav-theme="dark" className="w-screen bg-off-black">
      <div className="flex items-baseline justify-between px-5 sm:px-8 pt-14 sm:pt-20 pb-5">
        <h2 className="text-2xs font-sans tracking-label-xl uppercase text-text-muted">
          The Archive <span className="text-text-muted/60">· {items.length}</span>
        </h2>
        <Link
          to="/objects"
          className="inline-flex items-center gap-1.5 text-2xs font-sans tracking-label uppercase text-text-muted hover:text-cream transition-colors"
        >
          View all <ArrowRight size={10} />
        </Link>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border">
        {items.map((p) => (
          <li key={p.id} className="bg-off-black">
            <Link to={`/product/${p.id}`} className="group relative block aspect-[3/4] overflow-hidden bg-surface-2">
              <img
                src={p.heroImage ?? p.image}
                alt={p.altText || p.name}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ objectPosition: '50% 35%' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              {/* Testo sopra la foto: bianco vero in entrambe le versioni del
                  sito, la foto e' la stessa. */}
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 sm:px-4 sm:pb-4 bg-gradient-to-t from-black/65 via-black/25 to-transparent">
                <p className="text-white text-xs sm:text-sm tracking-[0.08em] leading-tight">{shortName(p.name)}</p>
                <p className="text-white/70 text-[11px] sm:text-xs mt-0.5">
                  {formatPrice(basePriceFor(p.id, null, p, dropCfg))}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function HomePage() {
  const [navTheme, setNavTheme] = useState('dark')
  const { setPageTheme, setActiveSection } = useThemeStore()

  usePageMeta({
    // usePageMeta appends " — JAYL"; keep the brand out of the title here to
    // avoid "JAYL — Art & Wearable Art — JAYL".
    title:       'Art & Wearable Art',
    description: 'Premium print-on-demand art and streetwear. AI-reinterpreted art movements meet contemporary culture. Free worldwide shipping.',
  })
  const navigate = useNavigate()
  const rootRef  = useRef(null)

  useEffect(() => {
    setPageTheme(navTheme)
    setActiveSection(null)
  }, [navTheme, setPageTheme, setActiveSection])

  // La navbar e' trasparente: il suo colore deve seguire lo schermo che le sta
  // sotto. Ogni sezione dichiara il proprio tema con data-nav-theme, e qui si
  // legge quello della sezione sotto la barra — niente array di indici da
  // tenere allineato a mano con le sezioni che davvero renderizzano (archivio
  // e recensioni spariscono da sole quando sono vuoti).
  const handleScroll = useCallback(() => {
    const els = rootRef.current?.querySelectorAll('[data-nav-theme]')
    if (!els?.length) return
    const probe = window.scrollY + 56
    let theme = els[0].dataset.navTheme
    for (const el of els) {
      if (el.offsetTop <= probe) theme = el.dataset.navTheme
    }
    setNavTheme(theme)
  }, [])

  useEffect(() => {
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <div ref={rootRef} className="w-full">

      {/* ════ SECTION 1 — Art Hero (cream) — HIDDEN - re-enable for Art launch ════
      <section className="h-screen w-screen relative overflow-hidden" style={{ backgroundColor: '#f5f0e8', colorScheme: 'light' }}>
        ...art hero content...
      </section>
      ════ SECTION 2 — Art fullscreen — HIDDEN - re-enable for Art launch ════
      <section className="h-screen w-screen relative overflow-hidden cursor-pointer" onClick={() => navigate(`/product/${featuredArt?.id}`)}>
        ...art fullscreen content...
      </section>
      ════════════════════════════════════════════════════════════════════════ */}

      {/* ════ SCREEN 1 — Il drop: NEW, tre schede, prezzo, subscribe. Uno
          schermo esatto (svh: la barra del browser mobile non taglia il
          subscribe), con un minimo sotto il quale si scorre invece di
          schiacciare le foto. ════ */}
      <section data-nav-theme="dark" className="h-[100svh] min-h-[640px] w-screen bg-off-black flex flex-col overflow-hidden">
        <DropHero />
        <SubscribeForm className="px-5 pb-6 sm:pb-8" />
      </section>

      {/* ════ SCREEN 2 — L'archivio, a tutto schermo ════ */}
      <ArchiveGrid items={archiveProducts} />

      {/* ════ Recensioni — subito sotto l'archivio, una alla volta.
          Si nasconde da sola finché reviews.json è vuoto. ════ */}
      <HomeReviews />

      {/* ════ Artist's (cream) ════════════════════════════════════════ */}
      <section
        data-nav-theme="light"
        className="h-screen w-screen bg-paper relative flex items-center justify-center cursor-pointer"
        onClick={() => navigate('/artist')}
      >
        <div className="absolute top-[88px] left-6 sm:left-8 z-10">
          <p className="text-2xs font-sans tracking-label-xl uppercase text-ink-muted">
            artist'<FallingS />
          </p>
        </div>

        <div className="px-6 sm:px-12 lg:px-20 max-w-3xl text-center">
          <p className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink leading-[1.45]">
            Every great artist drew the world differently — they saw their world. JAYL takes the
            greatest visual languages in history and applies them to subjects, emotions, and
            landscapes they never reached.
          </p>
        </div>
      </section>

    </div>
  )
}
