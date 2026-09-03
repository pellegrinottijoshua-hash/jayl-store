import { useEffect, useRef, useState } from 'react'
import { products as allProducts } from '@/data/products-full'
import { getAdminPassword } from '@/components/generate-assets/constants'
import { blobDirectUpload } from '@/lib/blobDirectUpload'

// ── Upload helper per il picker hero ─────────────────────────────────────────
// Vercel Blob first, poi action:'upload-image' con blobUrl — stesso percorso
// di AdminPage.jsx (upload di un'immagine prodotto verso Blob) e di
// AdminProductPage.jsx (upload del print file), non il vecchio dataUrl
// base64: gli hero sono macrofotografie, spesso oltre il limite di 4.5 MB
// del body delle function Vercel, quindi il vecchio percorso base64 falliva
// con un 413 garantito sopra quella soglia. Nessun secondo percorso di
// upload introdotto — stessa azione upload-image di api/admin.js, solo con
// blobUrl al posto di dataUrl.
const sanitizeFilename = (name) => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

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

// ── Hero + cap per-prodotto, uno per pezzo selezionato nel drop ────────────
// Un solo compito: mostrare/sostituire l'hero del pannello home. Tutte le
// altre immagini del prodotto (pool, gallery) restano nell'editor prodotto —
// qui elencarle tutte come thumbnail (9-14 per prodotto) non aiutava a
// scegliere, affollava soltanto la scheda.
function ProductHeroPicker({ product, heroUrl, capOverride, onSetHero, onSetCap }) {
  const fileRef = useRef(null)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(null) // { phase, pct? }
  const [uploadErr, setUploadErr]   = useState('')

  const isOverride = Boolean(heroUrl)
  // Stesso fallback di DropPanels sulla home (heroImage ?? image) — così
  // l'anteprima mostra davvero cosa vedrebbe uno shopper senza override.
  const previewUrl = heroUrl || product.heroImage || product.image

  const doUpload = async (files) => {
    const file = files?.[0]
    if (!file) return
    const filename = sanitizeFilename(file.name)
    const mb = (file.size / 1024 / 1024).toFixed(1)
    setUploading(true)
    setUploadErr('')
    setProgress({ phase: `Upload su Blob (${mb} MB)`, pct: 0 })
    try {
      // Blob prima, poi upload-image con blobUrl — vedi commento in testa al
      // file. Niente più dataUrl base64: gli hero sono macrofotografie,
      // spesso oltre il limite di 4.5 MB del body delle function Vercel.
      const blob = await blobDirectUpload(`${product.id}/${filename}`, file, {
        clientPayload: JSON.stringify({ password: getAdminPassword(), productId: product.id }),
        onProgress: (pct) => setProgress({ phase: `Upload su Blob (${mb} MB)`, pct }),
      })
      setProgress({ phase: 'Commit su GitHub…' })
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-image', password: getAdminPassword(),
          productId: product.id, filename, blobUrl: blob.url,
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
      setProgress(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="border border-gray-800 rounded p-4 mb-3 flex gap-4">
      <div className="relative w-28 h-28 shrink-0 overflow-hidden rounded border border-gray-700 bg-gray-900">
        {previewUrl
          ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.opacity = '0.3' }} />
          )
          : (
            <span className="absolute inset-0 flex items-center justify-center text-center text-[10px] text-gray-600 px-1">
              nessuna immagine
            </span>
          )}
        <span className={`absolute bottom-0 left-0 right-0 text-center text-[8px] py-0.5 leading-none ${
          isOverride ? 'bg-emerald-600 text-white' : 'bg-gray-800/90 text-gray-400'
        }`}>
          {isOverride ? 'HERO' : 'DEFAULT'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm text-white truncate">{product.name}</span>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
            Cap
            <input type="number" min="1" value={capOverride ?? ''} placeholder="default"
              onChange={(e) => onSetCap(e.target.value)}
              className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs" />
          </label>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-1.5 border border-gray-700 hover:border-gray-500 rounded text-xs text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed">
            {uploading
              ? (progress?.pct != null ? `${progress.phase} — ${progress.pct}%` : progress?.phase || 'Upload…')
              : 'Carica nuovo hero'}
          </button>
          {isOverride && (
            <button type="button" onClick={() => onSetHero(null)} disabled={uploading}
              className="text-xs text-gray-400 underline hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
              Ripristina default (immagine di catalogo)
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => doUpload(e.target.files)} />
        </div>

        <p className="text-xs text-gray-600 mt-1.5">
          {isOverride
            ? 'Hero personalizzato per il pannello home.'
            : "Nessun hero scelto — il pannello usa l'immagine di catalogo del prodotto (heroImage o image)."}
        </p>
        {uploadErr && <p className="text-xs text-red-400 mt-1">{uploadErr}</p>}
      </div>
    </div>
  )
}
