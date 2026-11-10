import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import NewMark from './NewMark'
import ShippedPrice from './ShippedPrice'
import { VIDEO_VIGNETTE } from './videoVignette'
import { homeVideoSrc } from '@/lib/heroVideo'
import { shortProductName as shortName } from '@/lib/utils'

/**
 * Il drop su desktop: NEW animato come sul telefono, la scia dorata del tempo
 * le tre schede affiancate
 * e tutte visibili, il prezzo grande "shipped" sotto. Badge Etsy, recensioni e
 * iscrizione stanno sotto, in HomePage.
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
        <div className="h-[calc(100svh-120px)] min-h-[560px] flex flex-col pt-[94px] pb-3">
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
                  style={{ height: 'min(39vh, 520px)', aspectRatio: '2 / 3' }}
                >
                  {/* Col video niente foto sotto: si vedeva per un attimo prima del primo fotogramma. */}
                  {!src && <img src={photo} alt={p.altText || p.name} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 30%' }} />}
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
    </>
  )
}
