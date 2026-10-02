import { useEffect, useRef, useState } from 'react'
import { cardImageOf, cardVideoOf } from '@/lib/productMedia'

/**
 * La faccia di un prodotto nel catalogo (Objects, collezioni): il video hero
 * se c'e', altrimenti la foto hero.
 *
 * Il video si carica solo quando la scheda entra in vista, gira una volta e
 * resta sul fotogramma finale (il Pokémon); passando col mouse riparte.
 * Con "riduci movimento" o il risparmio dati resta la foto.
 */
export default function CardMedia({ product, className = '', imgClassName = '' }) {
  const photo = cardImageOf(product)
  const video = cardVideoOf(product)
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  const [still] = useState(() => {
    if (typeof window === 'undefined') return true
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData)
  })
  const withVideo = Boolean(video) && !still

  useEffect(() => {
    const v = ref.current
    if (!withVideo || !v) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); v.play().catch(() => {}) }
      else v.pause()
    }, { threshold: 0.5 })
    io.observe(v)
    return () => io.disconnect()
  }, [withVideo])

  // Il src arriva al primo ingresso in vista: si parte appena c'e'.
  useEffect(() => {
    if (inView) ref.current?.play().catch(() => {})
  }, [inView])

  const replay = () => {
    const v = ref.current
    if (!v) return
    v.currentTime = 0
    v.play().catch(() => {})
  }

  return (
    <div className={`relative w-full h-full ${className}`} onMouseEnter={withVideo ? replay : undefined}>
      {photo && (
        <img
          src={photo}
          alt={product.altText || product.name}
          loading="lazy"
          draggable={false}
          className={`w-full h-full object-cover ${imgClassName}`}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      {withVideo && (
        <video
          ref={(el) => {
            ref.current = el
            // React non scrive `muted` come attributo: senza, l'autoplay si blocca.
            if (el) { el.muted = true; el.defaultMuted = true }
          }}
          src={inView ? video : undefined}
          muted
          playsInline
          preload="none"
          disablePictureInPicture
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: '50% 38%' }}
        />
      )}
    </div>
  )
}
