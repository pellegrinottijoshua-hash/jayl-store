import { useEffect, useRef, useState } from 'react'
import { products as allProducts } from '@/data/products-full'
import { getAdminPassword } from '@/components/generate-assets/constants'

// ── Upload helpers per il picker hero ────────────────────────────────────────
// Duplicati volutamente da AdminProductPage.jsx / AdminPage.jsx invece che
// estratti in un modulo condiviso: lo stesso pattern (fileToBase64 +
// compressImage + sanitizeFilename, poi POST action:'upload-image') è già
// copiato in quei due file senza un util comune — seguirlo qui evita di
// introdurre la prima astrazione condivisa in un task che non la richiede,
// e non tocca api/admin.js (nessun secondo percorso di upload, stessa azione
// riusata).
const sanitizeFilename = (name) => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Comprime solo se serve (limite del body JSON su Vercel) — stessa soglia e
// stessa strategia (scala + qualità JPEG decrescenti) delle altre due copie.
function compressImage(file, maxMB = 3.2) {
  if (!file.type.startsWith('image/')) return Promise.resolve(file)
  if (file.size <= maxMB * 1024 * 1024) return Promise.resolve(file)
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const canvas = document.createElement('canvas')
      const tryCompress = (quality, scale) => {
        canvas.width  = Math.round(width  * scale)
        canvas.height = Math.round(height * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          if (blob.size <= maxMB * 1024 * 1024 || quality <= 0.25) {
            const baseName = file.name.replace(/\.[^.]+$/, '')
            resolve(new File([blob], baseName + '.jpg', { type: 'image/jpeg' }))
          } else if (quality > 0.45) {
            tryCompress(quality - 0.15, scale)
          } else {
            tryCompress(quality - 0.1, scale * 0.8)
          }
        }, 'image/jpeg', quality)
      }
      tryCompress(0.85, 1)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const post = (action, body = {}) =>
  fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: getAdminPassword(), ...body }),
  }).then((r) => r.json())

export default function DropTab() {
  const [cfg, setCfg]       = useState(null)
  const [sha, setSha]       = useState(null)
  const [status, setStatus] = useState(null)
  const [msg, setMsg]       = useState('')
  const [q, setQ]           = useState('')
  // Un solo flag per save/close: la Contents API richiede lo sha del blob
  // CORRENTE ad ogni PUT, quindi due scritture concorrenti dalla stessa scheda
  // (es. un doppio click) userebbero lo stesso sha e la seconda 409erebbe —
  // disabilitare i bottoni mentre una richiesta è in volo lo previene a monte.
  const [busy, setBusy]     = useState(false)

  const loadDrop = () =>
    post('get-drop').then((r) => {
      if (!r.ok) { setMsg(r.error || 'errore nel caricamento'); return }
      setCfg(r.drop)
      setSha(r.sha)
    })

  useEffect(() => {
    loadDrop()
    fetch('/api/drop-status').then((r) => r.json()).then(setStatus).catch(() => {})
  }, [])

  if (!cfg) return <p className="text-gray-500 text-sm">{msg || 'Caricamento…'}</p>

  const setCurrent = (patch) => setCfg((c) => ({ ...c, current: { ...c.current, ...patch } }))

  const toggleProduct = (id) => setCurrent({
    productIds: cfg.current.productIds.includes(id)
      ? cfg.current.productIds.filter((x) => x !== id)
      : [...cfg.current.productIds, id].slice(0, 3),
  })

  // Uno 0 esplicito su cap NON significa "chiuso": capFor() lo ritorna com'è, e
  // il gate del checkout legge `if (cap && ...)`, quindi 0 = illimitato con il
  // contatore nascosto — l'opposto di quel che un admin probabilmente intende.
  // Digitare "0" scatta subito a 1; non c'è modo di salvare uno 0 da qui.
  const setCap = (v) => setCurrent({ cap: v === '' ? '' : Math.max(1, parseInt(v, 10) || 1) })

  // Stesso trattamento di setCap sopra, per-prodotto: campo vuoto = "usa il
  // default" (rimuove la chiave, capFor() ricade su current.cap), qualunque
  // altro valore digitato scatta subito a un intero >= 1 — non c'è modo di
  // salvare uno 0 o un negativo da qui, stessa ragione di setCap (vedi nota
  // sopra e validateDropConfig in api/_lib/drop-config.js).
  const setProductCap = (productId, v) => setCfg((c) => {
    const caps = { ...(c.current.caps || {}) }
    if (v === '') delete caps[productId]
    else caps[productId] = Math.max(1, parseInt(v, 10) || 1)
    return { ...c, current: { ...c.current, caps } }
  })

  // Hero del pannello per un prodotto del drop. `url` null/undefined rimuove
  // la chiave invece di scrivere un valore vuoto: un heroImages.<id> presente
  // ma vuoto passerebbe la forma minima se non fosse per il controllo dedicato
  // in validateDropConfig, ma non ha senso — "nessun hero" è l'assenza della
  // chiave, che fa ricadere DropPanels su `heroImage ?? image`.
  const setHeroImage = (productId, url) => setCfg((c) => {
    const heroImages = { ...(c.current.heroImages || {}) }
    if (url) heroImages[productId] = url
    else delete heroImages[productId]
    return { ...c, current: { ...c.current, heroImages } }
  })

  const save = async () => {
    if (busy) return
    // Difesa in profondità: anche se il campo è rimasto vuoto o invalido al
    // momento del salvataggio, non mandiamo mai un cap <= 0 al server (il
    // server lo rifiuterebbe comunque, ma non c'è motivo di fargli fare
    // andata e ritorno per un errore che possiamo evitare qui).
    const capNum  = parseInt(cfg.current.cap, 10)
    const safeCap = Number.isFinite(capNum) && capNum > 0 ? capNum : 1

    // Stessa difesa in profondità di safeCap, applicata a ogni override
    // per-prodotto: setProductCap sopra già garantisce solo interi positivi
    // o l'assenza della chiave, questo è solo il secondo livello, come per
    // il cap di default.
    const safeCaps = Object.fromEntries(
      Object.entries(cfg.current.caps || {}).map(([id, v]) => {
        const n = parseInt(v, 10)
        return [id, Number.isFinite(n) && n > 0 ? n : 1]
      }),
    )

    // heroImages: solo stringhe non vuote verso il server — setHeroImage(null)
    // rimuove già la chiave lato client, questa è la seconda linea di difesa
    // per uno stato rimasto sporco (es. sessione più vecchia).
    const safeHeroImages = Object.fromEntries(
      Object.entries(cfg.current.heroImages || {}).filter(([, url]) => typeof url === 'string' && url.trim()),
    )

    const toSave = {
      ...cfg,
      current: {
        ...cfg.current,
        cap: safeCap,
        caps: safeCaps,
        heroImages: safeHeroImages,
      },
    }
    if (safeCap !== cfg.current.cap) setCurrent({ cap: safeCap })

    setBusy(true)
    setMsg('Salvataggio…')
    const r = await post('save-drop', { drop: toSave, sha })
    setBusy(false)
    if (r.ok) {
      // La Contents API richiede lo sha del blob CORRENTE ad ogni scrittura.
      // Senza salvare quello che il server restituisce qui, un secondo save
      // nella stessa sessione userebbe lo sha ormai stantio e fallirebbe con
      // un errore GitHub grezzo — "edit, save, edit di nuovo, save di nuovo"
      // è il flusso base, non un caso limite.
      if (r.sha) setSha(r.sha)
      setMsg('Salvato — il deploy parte da solo')
    } else {
      // cfg (le modifiche dell'admin) resta intatto: un retry riparte da qui,
      // niente viene perso.
      setMsg(r.error || 'errore')
    }
  }

  const closeDrop = async () => {
    if (busy || cfg.current.productIds.length === 0) return
    if (!confirm('Chiudere il drop? I pezzi passano in listino a prezzo pieno.')) return
    setBusy(true)
    setMsg('Chiusura…')
    const r = await post('close-drop')
    setBusy(false)
    if (!r.ok) { setMsg(r.error || 'errore'); return }
    if (r.sha) setSha(r.sha)
    setMsg(r.noop ? 'Drop già chiuso' : 'Drop chiuso')
    loadDrop()
  }

  const release = async (id) => {
    if (busy) return
    setBusy(true)
    const r = await post('release-product', { productId: id })
    setBusy(false)
    if (r.ok) {
      if (r.sha) setSha(r.sha)
      setCfg((c) => ({ ...c, released: r.released }))
    } else {
      setMsg(r.error || 'errore')
    }
  }

  const field = (label, value, onChange, type = 'text') => (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
    </label>
  )

  const filtered = allProducts.filter((p) =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-8 text-white">
      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-3">Drop corrente</h3>
        <div className="grid grid-cols-2 gap-x-4">
          {field('Numero', cfg.current.number, (v) => setCurrent({ number: parseInt(v, 10) || 1 }), 'number')}
          {field('Titolo', cfg.current.title, (v) => setCurrent({ title: v }))}
          {field('Apre (ISO UTC)',  cfg.current.startsAt, (v) => setCurrent({ startsAt: v }))}
          {field('Chiude (ISO UTC)', cfg.current.endsAt,  (v) => setCurrent({ endsAt: v }))}
          {field('Cap per pezzo (mai 0 — vedi nota sotto)', cfg.current.cap, setCap, 'number')}
          {field('Prezzo drop (cent)', cfg.current.dropPrice, (v) => setCurrent({ dropPrice: parseInt(v, 10) || 0 }), 'number')}
          {field('Prezzo bundle (cent)', cfg.current.bundlePrice, (v) => setCurrent({ bundlePrice: parseInt(v, 10) || 0 }), 'number')}
          {field('Prezzo listino (cent)', cfg.archivePrice, (v) => setCfg((c) => ({ ...c, archivePrice: parseInt(v, 10) || 0 })), 'number')}
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Cap 0 significherebbe "illimitato" col contatore nascosto, non "chiuso" — per fermare le
          vendite usa "Chiudi drop" o porta endsAt nel passato.
        </p>
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-1">
          I pezzi del drop — {cfg.current.productIds.length}/3
        </h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto…"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm mb-2" />
        <div className="max-h-64 overflow-y-auto border border-gray-800 rounded">
          {filtered.map((p) => {
            const on = cfg.current.productIds.includes(p.id)
            const s  = status?.products?.[p.id]
            return (
              <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                className={`w-full text-left px-3 py-2 text-sm flex justify-between ${on ? 'bg-emerald-900/40 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                <span>{on ? '✓ ' : ''}{p.name}</span>
                {s && <span className="text-xs opacity-70">{s.sold}/{s.cap} venduti</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-1">Hero dei pannelli</h3>
        <p className="text-xs text-gray-500 mb-3">
          Immagine mostrata nel pannello home di ogni pezzo. Senza selezione usa l'immagine di
          catalogo del prodotto (heroImage o image) — niente cambia lì.
        </p>
        {cfg.current.productIds.length === 0 && (
          <p className="text-xs text-gray-600">Seleziona dei pezzi sopra per scegliere il loro hero.</p>
        )}
        {cfg.current.productIds.map((id) => {
          const p = allProducts.find((pp) => pp.id === id)
          if (!p) return null
          return (
            <ProductHeroPicker
              key={id}
              product={p}
              heroUrl={cfg.current.heroImages?.[id]}
              capOverride={cfg.current.caps?.[id]}
              onSetHero={(url) => setHeroImage(id, url)}
              onSetCap={(v) => setProductCap(id, v)}
            />
          )
        })}
      </section>

      <section className="flex gap-3 items-center flex-wrap">
        <button onClick={save} disabled={busy}
          className="px-4 py-2 bg-white text-black rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          Salva
        </button>
        <button onClick={closeDrop} disabled={busy || cfg.current.productIds.length === 0}
          className="px-4 py-2 border border-red-700 text-red-400 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          Chiudi drop → listino
        </button>
        {msg && <span className="text-xs text-gray-400">{msg}</span>}
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-3">
          Vault — {allProducts.length - cfg.released.length - cfg.current.productIds.length} nascosti
        </h3>
        <div className="max-h-64 overflow-y-auto border border-gray-800 rounded">
          {allProducts
            .filter((p) => !cfg.released.includes(p.id) && !cfg.current.productIds.includes(p.id))
            .map((p) => (
              <div key={p.id} className="flex justify-between items-center px-3 py-2 text-sm text-gray-400">
                <span>{p.name}</span>
                <button onClick={() => release(p.id)} disabled={busy}
                  className="text-xs underline hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  Attiva in listino
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}

// ── Picker hero + cap per-prodotto, uno per pezzo selezionato nel drop ──────
function ProductHeroPicker({ product, heroUrl, capOverride, onSetHero, onSetCap }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  // heroImage e image NON sono duplicati dentro images (verificato sul
  // catalogo reale) — vanno aggiunti a mano come candidati, altrimenti
  // sparirebbero dal picker pur essendo immagini legittime del prodotto.
  const candidates = [...new Set(
    [product.heroImage, product.image, ...(product.images || [])].filter(Boolean),
  )]

  const doUpload = async (files) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadErr('')
    try {
      const compressed = await compressImage(file)
      const filename    = sanitizeFilename(compressed.name || file.name)
      const dataUrl      = await fileToBase64(compressed)
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-image', password: getAdminPassword(),
          productId: product.id, filename, dataUrl,
        }),
      }).then((res) => res.json())
      if (!r.ok) throw new Error(r.error || 'upload fallito')
      // `path` è già il formato relativo (`/images/<id>/<file>`) usato da
      // product.image/heroImage/images — coerente col resto del catalogo,
      // a differenza di `url` che sarebbe il raw.githubusercontent.com
      // completo (funzionerebbe comunque come <img src>, ma è l'eccezione
      // invece della regola in questo file).
      onSetHero(r.path || r.url)
    } catch (e) {
      setUploadErr(e.message || 'errore upload')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="border border-gray-800 rounded p-3 mb-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm text-white truncate">{product.name}</span>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
          Cap
          <input type="number" min="1" value={capOverride ?? ''} placeholder="default"
            onChange={(e) => onSetCap(e.target.value)}
            className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {candidates.map((url) => {
          const active = heroUrl === url
          return (
            <button key={url} type="button" onClick={() => onSetHero(active ? null : url)}
              title={active ? 'Hero del pannello — clic per rimuovere' : 'Usa come hero del pannello'}
              className={`relative w-16 h-16 border-2 overflow-hidden shrink-0 ${
                active ? 'border-emerald-500' : 'border-gray-700 hover:border-gray-500'
              }`}>
              <img src={url} alt="" className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.opacity = '0.3' }} />
              {active && (
                <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] px-0.5 leading-none pointer-events-none">
                  HERO
                </span>
              )}
            </button>
          )
        })}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-16 h-16 border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 text-[10px] flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
          {uploading ? '…' : '+ carica'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => doUpload(e.target.files)} />
      </div>

      <div className="mt-2 flex items-center gap-3">
        {heroUrl
          ? (
            <button type="button" onClick={() => onSetHero(null)}
              className="text-xs text-gray-400 underline hover:text-white">
              Ripristina default (immagine di catalogo)
            </button>
          )
          : <span className="text-xs text-gray-600">Nessun hero scelto — usa l'immagine di catalogo</span>}
        {uploadErr && <span className="text-xs text-red-400">{uploadErr}</span>}
      </div>
    </div>
  )
}
