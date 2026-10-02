import { useEffect, useRef, useState } from 'react'

/**
 * Video hero di prodotto (i Kling da 3 s: maglia → nero → Pokémon vero).
 *
 * Si comporta come una foto che si muove: muto, senza controlli, a tutto
 * riquadro; in loop, oppure (`loop={false}`) una volta sola con `onEnded`
 * alla fine — la scheda prodotto lo usa per passare al mockup 1.
 * Parte solo quando è in vista e si ferma fuori schermo, così la batteria e i dati di chi scorre la home non pagano video che
 * nessuno guarda. Con "riduci movimento" o il risparmio dati attivi, al posto
 * del video c'è `poster` (la prima foto del prodotto).
 *
 * `muted` va impostato anche sul nodo: React non lo scrive come attributo, e
 * senza l'attributo Safari iOS rifiuta l'autoplay.
 */
export default function HeroVideo({ src, poster, className = '', objectPosition = '50% 40%', label, loop = true, onEnded }) {
  const ref = useRef(null)
  const [still] = useState(() => {
    if (typeof window === 'undefined') return false
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    return Boolean(reduce || navigator.connection?.saveData)
  })

  useEffect(() => {
    const v = ref.current
    if (!v || still) return
    v.muted = true
    v.defaultMuted = true
    if (typeof IntersectionObserver === 'undefined') {
      v.play().catch(() => {})
      return
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) v.play().catch(() => {})
      else v.pause()
    }, { threshold: 0.25 })
    io.observe(v)
    return () => io.disconnect()
  }, [still, src])

  if (still) {
    return poster ? <img src={poster} alt={label || ''} className={className} style={{ objectPosition }} /> : null
  }
  return (
    <video
      ref={ref}
      // Niente poster: la foto del prodotto e il primo fotogramma del video
      // sono immagini diverse, e il passaggio si vedrebbe come uno scatto.
      // Con #t Safari mostra subito il primo fotogramma invece del nero.
      src={`${src}#t=0.001`}
      muted
      loop={loop}
      onEnded={onEnded}
      playsInline
      preload="metadata"
      disablePictureInPicture
      aria-label={label}
      className={className}
      style={{ objectPosition }}
    />
  )
}
