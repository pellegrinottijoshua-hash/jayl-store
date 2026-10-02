import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import { nextDropStartsAt } from '../../../api/_lib/drop-schedule.js'
import DropCountdown from './DropCountdown'
import NewMark from './NewMark'
import ShippedPrice from './ShippedPrice'
import { VIDEO_VIGNETTE } from './videoVignette'
import SubscribeForm from '@/components/SubscribeForm'
import { dropWindowState, BEFORE } from './dropWindowState'
import { homeVideoSrc } from '@/lib/heroVideo'
import { shortProductName as shortName } from '@/lib/utils'

/**
 * Il drop su desktop: NEW animato come sul telefono, la scia dorata del tempo
 * le tre schede affiancate
 * e tutte visibili, il prezzo grande "shipped" sotto, poi la lista d'attesa.
 *
 * I tre video partono insieme (quando tutti e tre hanno dati, o comunque dopo
 * un attimo), girano una volta e restano sul fotogramma finale: tre Pokémon
 * che compaiono nello stesso momento. Passando col mouse su una scheda, il suo
 * video riparte dall'inizio. I bordi sfumano nel nero della pagina, come nel
 * cilindro del telefono (videoVignette). Con "riduci movimento" o il
 * risparmio dati restano le foto.
 */

// Tempo massimo di attesa perche' i tre video siano pronti: dopo, parte chi c'e'.
const START_TIMEOUT_MS = 2500

export default function DropDesktop() {
  const cfg = getDrop()
  const { state, target } = dropWindowState(cfg)
  const reduceMotion = useReducedMotion()
  const [saveData] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData))

  // Stesse regole di DropHero: i pezzi di `current` finche' ci sono, poi quelli
  // del drop appena chiuso — lo schermo non resta mai vuoto.
  const currentIds     = cfg.current?.productIds || []
  const showingCurrent = currentIds.length > 0
  const shown = showingCurrent ? currentIds : (cfg.previous?.productIds || [])
  const items = shown.map(getProductById).filter(Boolean)
  const entry = showingCurrent ? cfg.current : null
  const price = showingCurrent ? cfg.current.dropPrice : cfg.archivePrice
  const withVideo = !reduceMotion && !saveData

  // Prima che il drop apra, "il prossimo drop" e' questo: un secondo
  // countdown verso cfg.next metterebbe due date diverse per la stessa
  // apertura. Aperto o chiuso, torna a voler dire il drop successivo.
  const nextStartsAt = nextDropStartsAt(cfg)

  // I tre video partono insieme: si aspetta che abbiano tutti dati.
  const videos = useRef([])
  const videoKey = items.map((p) => homeVideoSrc(entry, p) || '').join('|')
  useEffect(() => {
    if (!withVideo) return
    const vids = videos.current.filter(Boolean)
    if (!vids.length) return
    let started = false
    const start = () => {
      if (started) return
      started = true
      vids.forEach((v) => { v.currentTime = 0; v.play().catch(() => {}) })
    }
    const check = () => { if (vids.every((v) => v.readyState >= 3)) start() }
    vids.forEach((v) => v.addEventListener('canplay', check))
    check()
    const timer = setTimeout(start, START_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
      vids.forEach((v) => v.removeEventListener('canplay', check))
    }
  }, [withVideo, videoKey])

  const replay = (i) => {
    const v = videos.current[i]
    if (!v) return
    v.currentTime = 0
    v.play().catch(() => {})
  }

  return (
    <>
      {items.length > 0 && (
        <div className="min-h-[100svh] flex flex-col pt-[94px] pb-6">
          <NewMark word={(showingCurrent && cfg.current?.headline) || 'NEW'} fontSize="clamp(4rem, 8vw, 7.5rem)" />


          <div className="flex-1 flex items-center justify-center gap-6 xl:gap-10 px-8">
            {items.map((p, i) => {
              const src = withVideo ? homeVideoSrc(entry, p) : null
              const photo = entry?.heroImages?.[p.id] ?? p.heroImage ?? p.image
              return (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  onMouseEnter={() => replay(i)}
                  className="group relative block overflow-hidden bg-off-black"
                  style={{ height: 'min(56vh, 640px)', aspectRatio: '2 / 3' }}
                >
                  <img src={photo} alt={p.altText || p.name} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 30%' }} />
                  {src && (
                    <video
                      ref={(el) => {
                        videos.current[i] = el
                        // React non scrive `muted` come attributo: senza, l'autoplay si blocca.
                        if (el) { el.muted = true; el.defaultMuted = true }
                      }}
                      src={src}
                      muted
                      playsInline
                      preload="auto"
                      disablePictureInPicture
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: '50% 30%' }}
                    />
                  )}
                  {/* z-index esplicito: Chrome disegna il <video> su un suo livello, sopra
                      la sfumatura, e in fondo alla scheda restava una riga del video.
                      -1px: col bordo esatto la foto sporgeva di un pixel. */}
                  <div aria-hidden className="absolute -inset-px z-[1] pointer-events-none" style={{ background: VIDEO_VIGNETTE }} />
                  <p className="absolute z-[2] inset-x-0 bottom-5 text-center text-white text-[11px] tracking-[0.32em] uppercase pl-[0.32em]">
                    {shortName(p.name)}
                  </p>
                </Link>
              )
            })}
          </div>

          <ShippedPrice cents={price} className="pt-6" fontSize="clamp(3.5rem, 6vw, 5.5rem)" />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center pt-8 pb-16">
        <div className="relative overflow-hidden px-12">
          {/* La J decorativa a filo destro, come negli altri blocchi del sito */}
          <span
            aria-hidden="true"
            className="absolute right-[-0.05em] top-1/2 -translate-y-1/2 font-display leading-none select-none pointer-events-none"
            style={{ fontSize: 'clamp(8rem, 20vw, 20rem)', color: '#C4A35A', opacity: 0.04, letterSpacing: '-0.05em' }}
          >J</span>

          <div className="relative max-w-md mx-auto w-full text-center">
            <p className="text-[10px] font-sans tracking-[0.25em] uppercase mb-4" style={{ color: '#C4A35A', opacity: 0.7 }}>
              Get notified
            </p>
            <h2 className="font-display text-4xl text-cream leading-tight mb-4">
              Never miss a new release.
            </h2>
            <p className="text-fg/60 text-sm leading-relaxed mb-6">
              New designs land every few days at a launch price. After that they stay in
              the collection at full price. Join the list and get the next ones first.
            </p>
            {state === BEFORE ? (
              <DropCountdown to={target} label="opens in" className="block text-xs tracking-widest uppercase text-fg/50 tabular-nums mb-8" />
            ) : nextStartsAt && (
              <DropCountdown to={nextStartsAt} label="next release in" className="block text-xs tracking-widest uppercase text-fg/50 tabular-nums mb-8" />
            )}
            <SubscribeForm variant="waitlist" />
          </div>
        </div>
      </div>
    </>
  )
}
