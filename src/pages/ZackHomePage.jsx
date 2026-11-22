import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Volume2, VolumeX, RotateCcw, Music2 } from 'lucide-react'
import { products } from '@/data/products'
import { isZackProduct, Z } from '@/lib/world'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useThemeStore } from '@/store/themeStore'
import Money from '@/components/Money'
import EtsyRating from '@/components/EtsyRating'
import ZackEyes from '@/components/zack/ZackEyes'
import { cn } from '@/lib/utils'

// La home di zacktheduck.com: Zack the Duck.
// «Zack si veste»: gli occhi sono la testa, il capo sotto e' il corpo (il
// manichino su fondo nero). Sotto solo una riga: «T-SHIRT €25». Si tocca il
// capo e Zack fa l'occhiolino (dal lato del tocco), poi si apre la scheda,
// sempre sulla copertina. Swipe / frecce / due dita sul trackpad cambiano
// capo; gli occhi lo seguono. Sul capo: ↺ lo gira (mostra la 2ª foto della
// scheda, il lato liscio); sulla felpa «PRINT FRONT · BACK» sceglie la
// versione (parte da BACK): 4 viste.
// Desktop: tre posizioni che si scambiano in profondita' (il capo nuovo viene
// avanti e cresce, il vecchio torna di lato e rimpicciolisce).
// Sotto: badge Etsy, il video del brand con le 7 presentazioni del cast ai lati
// (su mobile in fila sotto) e la sigla. Mai Pokémon qui dentro.

const ORDER = ['zack-the-duck-tee', 'zack-the-duck-hoodie', 'zack-the-duck-crewneck']
const rank = (p) => { const k = ORDER.indexOf(p.id); return k === -1 ? 99 : k }
const zackProducts = products.filter(isZackProduct).sort((a, b) => rank(a) - rank(b))
const N = zackProducts.length

const VIDEO = { src: '/zack/video/zack-spotted.mp4', poster: '/zack/video/zack-spotted.jpg' }
const THEME_SONG = '/zack/audio/sigla.mp3'
// Il cast, nell'ordine deciso: Zack, gabbiano, gatto, piccione, tartaruga, falena, formica.
const CAST = [
  ['zack', 'Zack'], ['gabbiano', 'The seagull'], ['gatto', 'The cat'], ['piccione', 'The pigeon'],
  ['tartaruga', 'The turtle'], ['falena', 'The moth'], ['formica', 'The ant'],
]
const CONFUSED_SWIPES = 3     // cambi ravvicinati che confondono Zack
const label = 'font-sans text-[10px] uppercase'
// I bordi dell'immagine sfumano nel nero della pagina.
const FEATHER = 'radial-gradient(130% 100% at 50% 42%, #000 62%, transparent 100%)'
// Le tre posizioni su desktop: sinistra, centro, destra (2 = nascosto dietro).
const POS = {
  [-1]: { x: -350, scale: 0.6, opacity: 0.45, zIndex: 1 },
  0: { x: 0, scale: 1, opacity: 1, zIndex: 3 },
  1: { x: 350, scale: 0.6, opacity: 0.45, zIndex: 1 },
  2: { x: 0, scale: 0.4, opacity: 0, zIndex: 0 },
}
const offOf = (k, i) => { const d = (k - i + N) % N; return d === 0 ? 0 : d === 1 ? 1 : d === N - 1 ? -1 : 2 }

const sideTag = (p, u) => p.imageSides?.[u] || null
// La felpa ha due versioni (stampa davanti / dietro): le foto marcate F e B in admin.
const hasVersions = (p) => !!p.altPrintFileUrl && (p.images || []).some((u) => sideTag(p, u) === 'back')
// Le foto della scheda di un capo, nello stesso ordine della scheda (per la
// felpa: le neutre + quelle della versione). 1ª = copertina, 2ª = l'altro lato,
// quello che mostra ↺. L'ordine si sceglie in admin («Galleria in scheda»).
const galleryOf = (p, version) => {
  const imgs = p.images?.length ? p.images : [p.image]
  if (!version) return imgs
  return [...imgs.filter((u) => !sideTag(p, u)), ...imgs.filter((u) => sideTag(p, u) === version)]
}
// Il nome nella riga sotto il capo: «T-SHIRT», «HOODIE», «CREWNECK».
const LINE_NAME = { 'zack-the-duck-tee': 'T-shirt' }
const lineName = (p) => LINE_NAME[p.id] || p.shortName || p.name.replace(/^Zack the Duck\s*/i, '')

function useDesktop() {
  const q = '(min-width: 1024px)'
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const fn = () => setOn(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return on
}

function DressUp() {
  const eyesRef = useRef(null)
  const bodyRef = useRef(null)
  const stageRef = useRef(null)
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const desktop = useDesktop()
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [versions, setVersions] = useState({}) // felpa: 'front' | 'back' (la stampa scelta)
  const [flipped, setFlipped] = useState({})   // per capo: girato con ↺
  const prevIdx = useRef(0)
  const swipes = useRef([])
  const lookTimer = useRef(null)
  const dragged = useRef(false)
  const leaving = useRef(false)
  const wheel = useRef({ acc: 0, last: 0, locked: false, until: 0 })

  const p = zackProducts[idx]
  // La felpa parte dalla stampa dietro (la grande).
  const versionOf = (q) => (hasVersions(q) ? versions[q.id] || 'back' : null)
  const viewsOf = (q) => galleryOf(q, versionOf(q))
  const coverOf = (q) => { const v = viewsOf(q); return (flipped[q.id] && v[1]) || v[0] || q.image }
  // La scheda si apre sempre sulla copertina (Joshua, 16/11), sulla versione scelta.
  const hrefOf = (q) => `/product/${q.id}${versionOf(q) === 'back' ? '?side=back' : ''}`
  const labelOf = (q) => `${q.name}${versionOf(q) ? ` — ${versionOf(q)} print` : ''}`

  useEffect(() => { prevIdx.current = idx }, [idx])
  useEffect(() => () => clearTimeout(lookTimer.current), [])

  // Gli occhi guardano il corpo: un po' sotto il centro.
  const lookAtBody = (dx = 0) => {
    const r = bodyRef.current?.getBoundingClientRect()
    if (r) eyesRef.current?.lookAt(r.left + r.width / 2 + dx, r.top + r.height * 0.35)
  }

  // Cambio capo: niente occhiolino, gli occhi seguono e basta. Subito verso il
  // lato da cui arriva il capo nuovo, poi sul capo appena arriva.
  const go = (delta) => {
    if (!N || leaving.current) return
    const d = delta > 0 ? 1 : -1
    setDir(d)
    setIdx((i) => (i + delta + N) % N)
    eyesRef.current?.glance(d)
    clearTimeout(lookTimer.current)
    lookTimer.current = setTimeout(() => lookAtBody(), 220)
    const now = Date.now()
    swipes.current = [...swipes.current.filter((t) => now - t < 3500), now]
    if (swipes.current.length >= CONFUSED_SWIPES) {
      swipes.current = []
      eyesRef.current?.react(['confuso-a', 'confuso-b'], 1800)   // troppi swipe: confuso (Joshua 17/11)
      eyesRef.current?.shake()
    }
  }
  const goRef = useRef(go)
  goRef.current = go

  // Tocco sul capo: Zack guarda in camera, occhiolino veloce dal lato del
  // tocco (stile B: l'altro occhio socchiude), poi si apre la scheda.
  const open = (e) => {
    if (leaving.current || dragged.current) return
    const href = hrefOf(p)
    if (reduce) return navigate(href)
    leaving.current = true
    const eye = e?.clientX != null ? eyesRef.current?.sideOf(e.clientX) ?? 1 : 1
    const ms = eyesRef.current?.wink(eye, { style: 'B' }) ?? 0
    setTimeout(() => navigate(href), Math.max(0, ms - 60))
  }

  const turn = () => setFlipped((f) => ({ ...f, [p.id]: !f[p.id] }))
  // Cambiando versione si torna sul lato stampato.
  const pickVersion = (v) => {
    eyesRef.current?.react('concentrato', 800)   // controlla la stampa
    setVersions((s) => ({ ...s, [p.id]: v }))
    setFlipped((f) => ({ ...f, [p.id]: false }))
  }

  // Il saluto: al primo arrivo (una volta per visita) un occhiolino lento, con
  // la testa che rimbalza. Nessuno sta aspettando niente.
  useEffect(() => {
    if (reduce) return
    let seen = false
    try { seen = sessionStorage.getItem('zk-hi') === '1' } catch { /* private mode */ }
    if (seen) return
    const t = setTimeout(() => {
      eyesRef.current?.wink(Math.random() < 0.5 ? 0 : 1, { style: 'C', slow: true })
      try { sessionStorage.setItem('zk-hi', '1') } catch { /* private mode */ }
    }, 1600)
    return () => clearTimeout(t)
  }, [reduce])

  // Desktop: frecce della tastiera.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea')) return
      if (e.key === 'ArrowRight') goRef.current(1)
      if (e.key === 'ArrowLeft') goRef.current(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Desktop: swipe a due dita sul trackpad (wheel orizzontale). Una soglia, poi
  // fermo finche' la scia del gesto non si spegne (niente doppi cambi).
  useEffect(() => {
    const el = stageRef.current
    if (!el || !desktop) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()   // niente "indietro" del browser
      const w = wheel.current, now = performance.now()
      const gap = now - w.last
      w.last = now
      if (w.locked) { if (gap > 200 && now > w.until) w.locked = false; else return }
      if (gap > 200) w.acc = 0
      w.acc += e.deltaX
      if (Math.abs(w.acc) > 60) {
        goRef.current(w.acc > 0 ? 1 : -1)
        w.acc = 0; w.locked = true; w.until = now + 450
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [desktop])

  if (!N) return null
  const variants = {
    enter: (d) => ({ x: d > 0 ? '70%' : '-70%', opacity: 0, scale: 0.9, rotate: d > 0 ? 4 : -4 }),
    center: { x: 0, opacity: 1, scale: 1, rotate: 0 },
    exit: (d) => ({ x: d > 0 ? '-70%' : '70%', opacity: 0, scale: 0.9, rotate: d > 0 ? -4 : 4 }),
  }

  // Il capo (immagine): gira su se stesso quando cambia lato.
  const garment = (q) => (
    <motion.img
      key={`${versionOf(q)}-${!!flipped[q.id]}`}
      src={coverOf(q)}
      alt={q.altText || q.name}
      initial={{ rotateY: 80, opacity: 0.4 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="w-full h-full object-cover pointer-events-none"
      draggable={false}
    />
  )

  return (
    <section id="shop" className="pt-[calc(88px_+_var(--zk-xmas,0px))] lg:pt-[calc(84px_+_var(--zk-xmas,0px))] pb-4 scroll-mt-24">
      <div ref={stageRef} className="flex flex-col items-center">
        {/* La testa */}
        {/* Su desktop testa e corpo scalano con l'altezza della finestra: la
            riga «T-SHIRT €25» deve stare nel primo schermo anche su un portatile. */}
        <ZackEyes ref={eyesRef} className="relative z-10 w-[90vw] max-w-[480px] lg:max-w-[min(480px,58vh)] h-auto block cursor-pointer" />

        {/* Il corpo: il capo che Zack indossa. */}
        <div ref={bodyRef} className="relative w-[80vw] max-w-[360px] lg:w-[min(320px,36vh)] -mt-[1vw] lg:-mt-2"
          style={{ aspectRatio: '4 / 5', touchAction: 'pan-y' }}>
          {desktop ? (
            // Desktop: tutti i capi in tre posizioni che si scambiano.
            zackProducts.map((q, k) => {
              const off = offOf(k, idx), was = offOf(k, prevIdx.current)
              const to = POS[off]
              // Chi passa da un lato all'altro va dietro al centro, piccolo e spento.
              const wrap = Math.abs(off - was) === 2 && off !== 2 && was !== 2
              const animate = wrap
                ? { x: [POS[was].x, 0, to.x], scale: [POS[was].scale, 0.4, to.scale], opacity: [POS[was].opacity, 0, to.opacity] }
                : { x: to.x, scale: to.scale, opacity: to.opacity }
              const center = off === 0
              return (
                <motion.div
                  key={q.id}
                  initial={false}
                  animate={animate}
                  transition={wrap ? { duration: 0.55, ease: 'easeInOut' } : { type: 'spring', stiffness: 170, damping: 24 }}
                  onClick={(e) => (center ? open(e) : off !== 2 && go(off))}
                  onKeyDown={(e) => { if (center && e.key === 'Enter') open(e) }}
                  role={center ? 'link' : 'button'}
                  tabIndex={off === 2 ? -1 : 0}
                  aria-label={center ? labelOf(q) : `Show ${q.name}`}
                  className="absolute inset-0 cursor-pointer select-none"
                  style={{ zIndex: wrap ? 0 : to.zIndex, WebkitMaskImage: FEATHER, maskImage: FEATHER }}
                >
                  {garment(q)}
                </motion.div>
              )
            })
          ) : (
            // Mobile: un capo, si trascina a destra e a sinistra.
            <AnimatePresence custom={dir} initial={false}>
              <motion.div
                key={p.id}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 260, damping: 28, opacity: { duration: 0.2 } }}
                drag={N > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragStart={() => { dragged.current = true }}
                onDrag={(e, info) => lookAtBody(info.offset.x * 2.2)}
                onDragEnd={(e, info) => {
                  setTimeout(() => { dragged.current = false }, 60)
                  if (info.offset.x < -60 || info.velocity.x < -450) go(1)
                  else if (info.offset.x > 60 || info.velocity.x > 450) go(-1)
                  else lookAtBody()
                }}
                onTap={(e) => open(e)}
                className="absolute inset-0 cursor-pointer select-none"
                style={{ WebkitMaskImage: FEATHER, maskImage: FEATHER }}
                role="link"
                aria-label={labelOf(p)}
              >
                {garment(p)}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ↺ gira il capo: la 2ª foto della scheda (l'altro lato, liscio). */}
          {viewsOf(p).length > 1 && (
            <button type="button" onClick={turn} aria-pressed={!!flipped[p.id]}
              aria-label={flipped[p.id] ? 'Turn it back' : 'Turn it around'}
              className="absolute z-10 bottom-3 right-1 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform active:scale-90"
              style={{ background: 'rgba(17,17,17,0.6)', color: Z.gold, border: '1px solid rgba(196,163,90,0.45)' }}>
              <RotateCcw size={15} strokeWidth={1.8} className={cn('transition-transform duration-500', flipped[p.id] && '-rotate-180')} />
            </button>
          )}
          {/* Felpa: due versioni, stampa davanti o dietro. */}
          {hasVersions(p) && (
            <div role="radiogroup" aria-label="Print position"
              className="absolute z-10 bottom-3 left-1 flex items-center rounded-full backdrop-blur-sm p-0.5 font-sans font-bold text-[9px] uppercase"
              style={{ background: 'rgba(17,17,17,0.6)', border: '1px solid rgba(196,163,90,0.45)', letterSpacing: '0.14em' }}>
              <span className="pl-2.5 pr-1.5" style={{ color: 'rgba(245,240,232,0.55)' }}>Print</span>
              {['front', 'back'].map((v) => {
                const on = versionOf(p) === v
                return (
                  <button key={v} type="button" role="radio" aria-checked={on} onClick={() => pickVersion(v)}
                    aria-label={`${v} print`}
                    className="px-2.5 py-1.5 rounded-full uppercase transition-colors"
                    style={{ background: on ? Z.gold : 'transparent', color: on ? Z.black : Z.gold }}>
                    {v}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Una riga sola: nome e prezzo. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={p.id}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-4 flex items-baseline justify-center gap-4 font-sans font-extrabold uppercase text-base lg:text-lg"
            style={{ color: Z.cream, letterSpacing: '0.16em' }}>
            <span>{lineName(p)}</span>
            <Money cents={p.price} className="font-semibold" />
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  )
}

// Una presentazione del cast: parte solo quando si vede (batteria); un tocco
// le da' la voce (e la toglie a tutto il resto).
function CastCard({ id, name, sound, onSound, hidden, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause() }, { threshold: 0.2 })
    io.observe(v)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = !sound
    if (sound) { v.currentTime = 0; v.play().catch(() => {}) }
  }, [sound])
  return (
    <button type="button" onClick={onSound} tabIndex={hidden ? -1 : 0} aria-hidden={hidden || undefined}
      aria-label={`${name}${sound ? ' — sound off' : ' — sound on'}`}
      className={cn('relative block w-full overflow-hidden', className)}
      style={{ aspectRatio: '9 / 16', background: '#0b0b0b' }}>
      <video ref={ref} src={`/zack/video/cast/${id}.mp4`} poster={`/zack/video/cast/${id}.jpg`}
        muted loop playsInline preload="none" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      {sound && (
        <span className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(17,17,17,0.6)', color: Z.gold }}>
          <Volume2 size={12} strokeWidth={1.8} />
        </span>
      )}
    </button>
  )
}

// Desktop: una colonna del cast che scorre piano, all'infinito (la lista e'
// ripetuta due volte: a meta' corsa riparte da capo senza salti).
function CastColumn({ items, down, sound, setSound }) {
  const fade = 'linear-gradient(transparent, #000 10%, #000 90%, transparent)'
  return (
    <div className="zk-marquee hidden lg:block relative overflow-hidden w-[150px] xl:w-[170px] self-stretch"
      style={{ WebkitMaskImage: fade, maskImage: fade }}>
      <div className={cn('absolute inset-x-0 top-0', down ? 'zk-marquee-down' : 'zk-marquee-up')}>
        {[0, 1].map((copy) => items.map(([id, name]) => {
          const key = `${id}#${copy}`
          return (
            <div key={key} className="pb-4">
              <CastCard id={id} name={name} hidden={copy === 1} sound={sound === key}
                onSound={() => setSound((s) => (s === key ? null : key))} />
            </div>
          )
        }))}
      </div>
    </div>
  )
}

function Spotted() {
  const ref = useRef(null)
  const songRef = useRef(null)
  // Chi ha la voce: 'main' (il video del brand), una presentazione, o nessuno.
  const [sound, setSound] = useState(null)
  const [song, setSong] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = sound !== 'main'
    if (sound === 'main') v.play().catch(() => {})
    // Una cosa alla volta: se parla un video, la sigla si ferma.
    if (sound) { songRef.current?.pause(); setSong(false) }
  }, [sound])
  useEffect(() => {
    const a = songRef.current
    return () => a?.pause()
  }, [])

  const toggleSong = () => {
    const a = songRef.current
    if (!a) return
    if (song) { a.pause(); setSong(false); return }
    setSound(null)
    a.play().then(() => setSong(true)).catch(() => setSong(false))
  }

  return (
    // A tutto schermo sul telefono (9:16), alto quasi quanto la finestra su desktop.
    <section className="pt-14 pb-24">
      <div className="flex items-center justify-center gap-3 mb-6">
        <p className={label} style={{ letterSpacing: '0.42em', color: Z.gold }}>Spotted.</p>
        {/* La sigla di Zack. */}
        <button type="button" onClick={toggleSong} aria-pressed={song}
          aria-label={song ? 'Stop the Zack the Duck theme song' : 'Play the Zack the Duck theme song'}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: song ? Z.black : Z.gold, background: song ? Z.gold : 'transparent', border: '1px solid rgba(196,163,90,0.5)' }}>
          {song ? <span className="zk-eq" aria-hidden><span /><span /><span /></span> : <Music2 size={14} strokeWidth={1.8} />}
        </button>
        <audio ref={songRef} src={THEME_SONG} preload="none" onEnded={() => setSong(false)} />
      </div>

      <div className="flex justify-center items-stretch gap-6 xl:gap-8">
        <CastColumn items={CAST.slice(0, 4)} sound={sound} setSound={setSound} />
        <div className="relative w-full sm:w-auto sm:h-[86vh] sm:max-h-[900px]" style={{ aspectRatio: '9 / 16' }}>
          <video
            ref={ref}
            src={VIDEO.src}
            poster={VIDEO.poster}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ background: '#0b0b0b' }}
          />
          <button onClick={() => setSound((s) => (s === 'main' ? null : 'main'))} aria-label={sound === 'main' ? 'Sound off' : 'Sound on'}
            className="absolute bottom-4 right-4 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm"
            style={{ background: 'rgba(17,17,17,0.55)', color: Z.cream }}>
            {sound === 'main' ? <Volume2 size={16} strokeWidth={1.6} /> : <VolumeX size={16} strokeWidth={1.6} />}
          </button>
        </div>
        <CastColumn items={CAST.slice(4)} down sound={sound} setSound={setSound} />
      </div>

      {/* Mobile: il cast in fila sotto il video. */}
      <div className="lg:hidden mt-5 flex gap-3 overflow-x-auto snap-x snap-mandatory px-5 scroll-px-5 zk-noscrollbar" aria-label="The cast">
        {CAST.map(([id, name]) => (
          <div key={id} className="shrink-0 w-[36vw] max-w-[180px] snap-start">
            <CastCard id={id} name={name} sound={sound === id} onSound={() => setSound((s) => (s === id ? null : id))} />
          </div>
        ))}
      </div>
    </section>
  )
}

const PERKS = [
  ['Free shipping', 'Worldwide, always.'],
  ['Printed near you', 'On demand, less waste.'],
  ['Designed in Venice', 'By JAYL.'],
]

export default function ZackHomePage() {
  const { hash } = useLocation()
  // "/#shop": dopo il salto in cima di ScrollToTop, giu' ai capi.
  useEffect(() => {
    if (hash !== '#shop') return
    const t = setTimeout(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }), 60)
    return () => clearTimeout(t)
  }, [hash])
  const setPageTheme = useThemeStore((s) => s.setPageTheme)
  useEffect(() => { setPageTheme?.('dark') }, [setPageTheme])

  // Le viste degli altri capi (copertina e lato girato, le due versioni della
  // felpa) si caricano a pagina ferma, per non rallentare il primo schermo.
  useEffect(() => {
    const t = setTimeout(() => {
      zackProducts
        .flatMap((p) => (hasVersions(p) ? ['front', 'back'] : [null]).flatMap((v) => galleryOf(p, v).slice(0, 2)))
        .forEach((src) => { const im = new Image(); im.src = src })
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  usePageMeta({
    title: 'Zack the Duck — Official Merch',
    description: 'Zack the Duck: the deadpan duck. Tee, hoodie and crewneck with his eyes on the front. Free worldwide shipping.',
    image: '/zack/og-zack.jpg',
    url: 'https://zacktheduck.com/',
  })

  return (
    <div style={{ background: Z.black, color: Z.cream }} className="min-h-screen overflow-x-hidden">
      <DressUp />
      {/* Il voto Etsy: dopo i capi, prima del video, non in faccia. */}
      <EtsyRating className="flex justify-center px-5 pt-10" />
      <Spotted />

      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center border-t pt-12" style={{ borderColor: 'rgba(245,240,232,0.1)' }}>
          {PERKS.map(([t, s]) => (
            <div key={t}>
              <p className="font-sans font-bold uppercase text-sm" style={{ letterSpacing: '0.08em' }}>{t}</p>
              <p className="font-sans text-xs mt-1.5" style={{ color: 'rgba(245,240,232,0.5)' }}>{s}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
