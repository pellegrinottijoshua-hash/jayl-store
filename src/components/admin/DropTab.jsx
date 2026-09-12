import { useEffect, useRef, useState } from 'react'
import { products as allProducts } from '@/data/products-full'
import { getAdminPassword } from '@/components/generate-assets/constants'
import { blobDirectUpload } from '@/lib/blobDirectUpload'

// Stato in chiaro di una voce drop, dalle sue sole date. Il pannello mostrava
// "DROP CORRENTE" identico sopra un drop che vendeva e sopra uno finito da
// ore: la sezione si chiama "corrente" per la sua posizione nella config, non
// perché quel drop sia davvero in vendita, e da lì nasceva la confusione di
// trovare in admin come corrente un drop che in home era già chiuso.
function entryState(entry, now = Date.now()) {
  const starts = Date.parse(entry?.startsAt)
  const ends   = Date.parse(entry?.endsAt)
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) {
    return { key: 'unknown', label: 'DATE NON VALIDE', tone: 'bg-red-900/60 text-red-200' }
  }
  if (!(entry?.productIds || []).length) {
    return { key: 'empty', label: 'CHIUSO — NESSUN PEZZO', tone: 'bg-gray-700 text-gray-300' }
  }
  if (now < starts) return { key: 'before', label: 'IN ANTEPRIMA — NON ANCORA IN VENDITA', tone: 'bg-amber-900/60 text-amber-200' }
  if (now >= ends)  return { key: 'closed', label: 'CHIUSO — I PEZZI SONO IN ARCHIVIO', tone: 'bg-gray-700 text-gray-300' }
  return { key: 'live', label: 'IN VENDITA ORA', tone: 'bg-emerald-800/70 text-emerald-100' }
}

/** "fra 2g 4h" / "3h 12m fa" — durata leggibile rispetto ad adesso. */
function relTime(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const diff = t - now
  const abs  = Math.abs(diff)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor((abs % 86400000) / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const parts = d ? `${d}g ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  return diff >= 0 ? `fra ${parts}` : `${parts} fa`
}

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

// ── Sanificazione di una voce drop, prima di mandarla al server ────────────
// Difesa in profondità condivisa da `current` e da ogni voce programmata: il
// server rifiuterebbe comunque un cap <= 0 o un heroImages con stringa vuota
// (validateDropEntry in api/_lib/drop-config.js), ma non c'è motivo di fargli
// fare andata e ritorno per un errore evitabile qui — e con più drop nello
// stesso salvataggio un solo campo sporco in fondo alla lista farebbe
// rifiutare l'INTERO save, current compreso.
function sanitizeEntry(entry) {
  const capNum  = parseInt(entry.cap, 10)
  const safeCap = Number.isFinite(capNum) && capNum > 0 ? capNum : 1

  const safeCaps = Object.fromEntries(
    Object.entries(entry.caps || {}).map(([id, v]) => {
      const n = parseInt(v, 10)
      return [id, Number.isFinite(n) && n > 0 ? n : 1]
    }),
  )

  const safeHeroImages = Object.fromEntries(
    Object.entries(entry.heroImages || {}).filter(([, url]) => typeof url === 'string' && url.trim()),
  )

  return { ...entry, cap: safeCap, caps: safeCaps, heroImages: safeHeroImages }
}

const field = (label, value, onChange, type = 'text') => (
  <label className="block mb-3">
    <span className="block text-xs text-gray-400 mb-1">{label}</span>
    <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
  </label>
)

// ── Campi di UNA voce drop ─────────────────────────────────────────────────
// Usati identici dal drop corrente e da ogni drop programmato: il cron
// promuove una voce programmata copiandola in `current` così com'è
// (api/_lib/drop-schedule.js), quindi due form diversi qui vorrebbero dire
// due forme diverse per la stessa cosa — e un campo che si può impostare solo
// dopo la promozione, quando ormai il drop è in vetrina.
function DropEntryFields({ entry, onChange }) {
  // Uno 0 esplicito su cap NON significa "chiuso": capFor() lo ritorna com'è, e
  // il gate del checkout legge `if (cap && ...)`, quindi 0 = illimitato con il
  // contatore nascosto — l'opposto di quel che un admin probabilmente intende.
  // Digitare "0" scatta subito a 1; non c'è modo di salvare uno 0 da qui.
  const setCap = (v) => onChange({ cap: v === '' ? '' : Math.max(1, parseInt(v, 10) || 1) })

  return (
    <div className="grid grid-cols-2 gap-x-4">
      {field('Numero', entry.number, (v) => onChange({ number: parseInt(v, 10) || 1 }), 'number')}
      {field('Titolo', entry.title, (v) => onChange({ title: v }))}
      {field('Apre (ISO UTC)',  entry.startsAt, (v) => onChange({ startsAt: v }))}
      {field('Chiude (ISO UTC)', entry.endsAt,  (v) => onChange({ endsAt: v }))}
      {field('Cap per pezzo (mai 0 — vedi nota sotto)', entry.cap, setCap, 'number')}
      {field('Prezzo drop (cent)', entry.dropPrice, (v) => onChange({ dropPrice: parseInt(v, 10) || 0 }), 'number')}
      {field('Prezzo bundle (cent)', entry.bundlePrice, (v) => onChange({ bundlePrice: parseInt(v, 10) || 0 }), 'number')}
      {field('ID drop (unico)', entry.id, (v) => onChange({ id: v }))}
    </div>
  )
}

// ── Selettore dei (massimo 3) pezzi di una voce drop ───────────────────────
// La ricerca è stato LOCALE del selettore: con più drop programmati in pagina
// una `q` sola condivisa filtrerebbe tutte le liste insieme, cioè cercare un
// pezzo per il drop 03 nasconderebbe i pezzi già scelti per il 02.
function ProductPicker({ products, selected, onToggle, status }) {
  const [q, setQ] = useState('')
  const filtered = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto…"
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm mb-2" />
      <div className="max-h-64 overflow-y-auto border border-gray-800 rounded">
        {filtered.map((p) => {
          const on = selected.includes(p.id)
          const s  = status?.products?.[p.id]
          return (
            <button key={p.id} type="button" onClick={() => onToggle(p.id)}
              className={`w-full text-left px-3 py-2 text-sm flex justify-between ${on ? 'bg-emerald-900/40 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
              <span>{on ? '✓ ' : ''}{p.name}</span>
              {s && <span className="text-xs opacity-70">{s.sold}/{s.cap} venduti</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

export default function DropTab() {
  const [cfg, setCfg]       = useState(null)
  const [sha, setSha]       = useState(null)
  const [status, setStatus] = useState(null)
  const [msg, setMsg]       = useState('')
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

  // Accetta un patch o una funzione (entry) => patch, esattamente come
  // patchScheduled: setHeroImage e setProductCap sono condivisi fra il drop
  // corrente e quelli programmati e passano sempre una funzione.
  const setCurrent = (patchOrFn) => setCfg((c) => {
    const patch = typeof patchOrFn === 'function' ? patchOrFn(c.current) : patchOrFn
    return { ...c, current: { ...c.current, ...patch } }
  })

  const toggleProduct = (id) => setCurrent({
    productIds: cfg.current.productIds.includes(id)
      ? cfg.current.productIds.filter((x) => x !== id)
      : [...cfg.current.productIds, id].slice(0, 3),
  })

  // Stesso trattamento di setCap sopra, per-prodotto: campo vuoto = "usa il
  // default" (rimuove la chiave, capFor() ricade su current.cap), qualunque
  // altro valore digitato scatta subito a un intero >= 1 — non c'è modo di
  // salvare uno 0 o un negativo da qui, stessa ragione di setCap (vedi nota
  // sopra e validateDropConfig in api/_lib/drop-config.js).
  const setProductCap = (patchEntry) => (productId, v) => patchEntry((entry) => {
    const caps = { ...(entry.caps || {}) }
    if (v === '') delete caps[productId]
    else caps[productId] = Math.max(1, parseInt(v, 10) || 1)
    return { caps }
  })

  // Hero del pannello per un prodotto del drop. `url` null/undefined rimuove
  // la chiave invece di scrivere un valore vuoto: un heroImages.<id> presente
  // ma vuoto passerebbe la forma minima se non fosse per il controllo dedicato
  // in validateDropConfig, ma non ha senso — "nessun hero" è l'assenza della
  // chiave, che fa ricadere DropPanels su `heroImage ?? image`.
  const setHeroImage = (patchEntry) => (productId, url) => patchEntry((entry) => {
    const heroImages = { ...(entry.heroImages || {}) }
    if (url) heroImages[productId] = url
    else delete heroImages[productId]
    return { heroImages }
  })

  // ── Drop programmati ─────────────────────────────────────────────────────
  // Stessa forma di `current`, perché il cron promuove una voce copiandola lì
  // così com'è (api/_lib/drop-schedule.js).
  const scheduled = cfg.scheduled || []

  const patchScheduled = (i) => (patchOrFn) => setCfg((c) => {
    const list = [...(c.scheduled || [])]
    const patch = typeof patchOrFn === 'function' ? patchOrFn(list[i]) : patchOrFn
    list[i] = { ...list[i], ...patch }
    return { ...c, scheduled: list }
  })

  const toggleScheduledProduct = (i) => (id) => patchScheduled(i)((entry) => ({
    productIds: entry.productIds.includes(id)
      ? entry.productIds.filter((x) => x !== id)
      : [...entry.productIds, id].slice(0, 3),
  }))

  const removeScheduled = (i) => {
    if (!confirm('Rimuovere questo drop programmato? I pezzi restano dove sono, non viene pubblicato nulla.')) return
    setCfg((c) => ({ ...c, scheduled: (c.scheduled || []).filter((_, idx) => idx !== i) }))
  }

  // Nuova voce precompilata: numero e date che seguono l'ultimo drop
  // conosciuto, prezzi e cap copiati dal corrente. L'id è derivato dal numero
  // e deve restare unico — il registro vendite (api/_lib/drop-sales.js) è
  // indicizzato per id, e due drop che ne condividono uno condividerebbero
  // anche i contatori: il secondo aprirebbe già sold-out. save-drop lo
  // rifiuta, ma è meglio non proporlo nemmeno.
  const addScheduled = () => setCfg((c) => {
    const list    = c.scheduled || []
    const numbers = [c.current?.number || 0, ...list.map((e) => e.number || 0)]
    const number  = Math.max(...numbers) + 1

    // Attaccato alla chiusura dell'ultimo drop conosciuto: apre nell'istante
    // esatto in cui quello chiude, finestra di 72 ore. Prima il default era
    // una settimana dopo, che lasciava scoperta la vetrina per sette giorni e
    // costringeva a correggere le date a mano ogni volta — i drop qui sono
    // pensati per essere consecutivi, quindi è quello il default giusto.
    // Contiguo è anche la condizione in cui la promozione automatica funziona
    // meglio: il cron delle 16:00 trova il corrente appena scaduto e questo
    // pronto ad aprire nello stesso giro.
    const lastEnd = [c.current?.endsAt, ...list.map((e) => e.endsAt)]
      .map((d) => Date.parse(d))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0] ?? Date.now()
    const startsAt = new Date(lastEnd)
    const endsAt   = new Date(startsAt.getTime() + 72 * 60 * 60 * 1000)

    const entry = {
      id: `drop-${String(number).padStart(2, '0')}`,
      number,
      title: '',
      productIds: [],
      startsAt: startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      endsAt:   endsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      cap:         c.current?.cap         ?? 20,
      caps:        {},
      dropPrice:   c.current?.dropPrice   ?? 2200,
      bundlePrice: c.current?.bundlePrice ?? 5700,
      heroImages:  {},
    }
    return { ...c, scheduled: [...list, entry] }
  })

  const save = async () => {
    if (busy) return

    // Difesa in profondità su OGNI voce, corrente e programmate: sanitizeEntry
    // riporta cap/caps a interi positivi e scarta gli heroImages vuoti. Il
    // server rifiuterebbe comunque, ma qui un solo campo sporco in fondo alla
    // lista dei programmati farebbe rifiutare l'intero salvataggio — drop
    // corrente compreso.
    const safeCurrent = sanitizeEntry(cfg.current)
    const toSave = {
      ...cfg,
      current: safeCurrent,
      scheduled: (cfg.scheduled || []).map(sanitizeEntry),
    }
    if (safeCurrent.cap !== cfg.current.cap) setCurrent({ cap: safeCurrent.cap })

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

  // Ricalcolato a ogni render: basta a far cambiare il badge quando l'admin
  // sposta le date nei campi qui sotto, che è il momento in cui serve davvero
  // vederlo cambiare. Niente timer — un drop che scade con la pagina aperta è
  // un caso che il prossimo caricamento risolve da sé.
  const currentState = entryState(cfg.current)
  const past = Array.isArray(cfg.past) ? cfg.past : []

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

  return (
    <div className="space-y-8 text-white">
      <section>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-sm uppercase tracking-widest text-gray-400">
            Drop corrente — {String(cfg.current?.number ?? '?').padStart(2, '0')} · {cfg.current?.title || 'senza titolo'}
          </h3>
          <span className={`text-[11px] tracking-widest uppercase px-2 py-1 rounded ${currentState.tone}`}>
            {currentState.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {currentState.key === 'live' && <>Chiude {relTime(cfg.current.endsAt)} — {cfg.current.endsAt}</>}
          {currentState.key === 'before' && <>Apre {relTime(cfg.current.startsAt)} — {cfg.current.startsAt}</>}
          {currentState.key === 'closed' && (
            <>
              Chiuso {relTime(cfg.current.endsAt)}. {scheduled.length > 0
                ? `Il prossimo programmato apre il ${scheduled[0].startsAt}.`
                : 'Nessun drop programmato: la home resta senza drop attivo finché non ne programmi uno qui sotto.'}
            </>
          )}
          {currentState.key === 'empty' && <>Chiuso a mano. I pezzi sono in listino a prezzo pieno.</>}
        </p>
        <DropEntryFields entry={cfg.current} onChange={setCurrent} />
        <div className="grid grid-cols-2 gap-x-4">
          {field('Prezzo listino (cent) — vale per tutti i drop', cfg.archivePrice, (v) => setCfg((c) => ({ ...c, archivePrice: parseInt(v, 10) || 0 })), 'number')}
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
        <ProductPicker products={allProducts} selected={cfg.current.productIds}
          onToggle={toggleProduct} status={status} />
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
              onSetHero={(url) => setHeroImage(setCurrent)(id, url)}
              onSetCap={(v) => setProductCap(setCurrent)(id, v)}
            />
          )
        })}
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-1">
          Prossimi drop — {scheduled.length} programmati
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Un drop programmato subentra da solo in due momenti: quando premi <em>Chiudi drop</em>
          {' '}(subentra nello stesso salvataggio, senza buchi in vetrina) e col cron delle 16:00,
          allineato all'ora in cui i tuoi drop cambiano. In entrambi i casi chiude il corrente
          (i pezzi passano in listino), mette questo al suo posto e committa — il commit fa
          partire il deploy. Fino a <em>Apre</em> il drop resta in anteprima: si vede in home,
          non si può comprare. Un drop corrente ancora aperto non viene mai interrotto a metà.
        </p>

        {scheduled.length === 0 && (
          <p className="text-xs text-amber-300/80 mb-3">
            Nessun drop programmato. Quando il corrente chiude non subentra niente e la home resta
            senza drop attivo: programmane uno qui sotto: si precompila attaccato alla chiusura del
            corrente, così i due sono consecutivi.
          </p>
        )}

        {scheduled.map((entry, i) => (
          <div key={i} className="border border-gray-800 rounded p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase tracking-widest text-gray-500">
                Drop {entry.number} — apre il {entry.startsAt}
              </span>
              <button type="button" onClick={() => removeScheduled(i)} disabled={busy}
                className="text-xs text-red-400 underline hover:text-red-300 disabled:opacity-40">
                Rimuovi
              </button>
            </div>

            <DropEntryFields entry={entry} onChange={patchScheduled(i)} />

            <h4 className="text-xs uppercase tracking-widest text-gray-500 mt-2 mb-1">
              I pezzi — {entry.productIds.length}/3
            </h4>
            <ProductPicker products={allProducts} selected={entry.productIds}
              onToggle={toggleScheduledProduct(i)} status={status} />

            {entry.productIds.length > 0 && (
              <>
                <h4 className="text-xs uppercase tracking-widest text-gray-500 mt-4 mb-1">
                  Hero dei pannelli
                </h4>
                {entry.productIds.map((id) => {
                  const p = allProducts.find((pp) => pp.id === id)
                  if (!p) return null
                  return (
                    <ProductHeroPicker
                      key={id}
                      product={p}
                      heroUrl={entry.heroImages?.[id]}
                      capOverride={entry.caps?.[id]}
                      onSetHero={(url) => setHeroImage(patchScheduled(i))(id, url)}
                      onSetCap={(v) => setProductCap(patchScheduled(i))(id, v)}
                    />
                  )
                })}
              </>
            )}
          </div>
        ))}

        <button type="button" onClick={addScheduled} disabled={busy}
          className="px-4 py-2 border border-gray-700 hover:border-gray-500 rounded text-sm text-gray-300 disabled:opacity-40">
          + Programma un drop
        </button>
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-1">
          Drop passati — {past.length}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Archivio in sola lettura: ogni drop concluso finisce qui, con la sua finestra e i suoi
          pezzi. I pezzi restano in vendita nell'archivio a {(cfg.archivePrice / 100).toFixed(2)}€.
        </p>

        {past.length === 0 && (
          <p className="text-xs text-gray-600">
            Nessun drop concluso ancora — il primo comparirà qui alla prima chiusura.
          </p>
        )}

        {[...past].reverse().map((entry) => (
          <div key={entry.id} className="border border-gray-800 rounded px-4 py-3 mb-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-sm text-white">
                Drop {String(entry.number).padStart(2, '0')} · {entry.title}
              </span>
              <span className="text-[11px] tracking-widest uppercase text-gray-500">
                chiuso {relTime(entry.endsAt)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {entry.startsAt} → {entry.endsAt}
            </p>
            <ul className="mt-2 space-y-0.5">
              {(entry.productIds || []).map((id) => {
                const p = allProducts.find((pp) => pp.id === id)
                return (
                  <li key={id} className="text-xs text-gray-400 truncate">
                    · {p?.name || id}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
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
  // L'anteprima che non carica era muta: l'unico effetto era un'opacità 0.3
  // sul riquadro, senza dire quale URL avesse fallito. Da fuori diventava
  // "gli hero non caricano" senza un solo indizio su cosa guardare — file
  // mancante nel repo, path con un refuso, deploy non ancora pronto e cache
  // del browser hanno tutti lo stesso identico aspetto. Ora l'errore si
  // vede e porta con sé il path.
  const [loadErr, setLoadErr]       = useState(false)
  // Anteprima del file appena scelto, presa dal file stesso nel browser.
  //
  // È la correzione del motivo per cui un hero appena caricato appariva rotto.
  // Due URL sembrano il candidato ovvio e nessuno dei due funziona subito:
  //  · il path relativo `/images/...` è quello giusto da salvare in config,
  //    ma esiste in rete solo quando il deploy del commit di upload è pronto
  //    (un minuto o due): fino ad allora è un 404 proprio sull'upload riuscito;
  //  · l'URL di Vercel Blob sta su *.private.blob.vercel-storage.com — lo
  //    store è privato, e senza token firmato il browser non lo carica.
  // Il file però è già in memoria nel browser: mostrarlo non costa una
  // richiesta e non può fallire. In config continua ad andare il path
  // relativo — questo vive solo per la durata della sessione.
  const [localPreview, setLocalPreview] = useState(null)

  // Un object URL resta allocato finché non lo si revoca: qui si libera il
  // precedente a ogni cambio e l'ultimo allo smontaggio.
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])

  const isOverride = Boolean(heroUrl)
  // Stesso fallback di DropPanels sulla home (heroImage ?? image) — così
  // l'anteprima mostra davvero cosa vedrebbe uno shopper senza override.
  const previewUrl = localPreview || heroUrl || product.heroImage || product.image

  // Un nuovo path merita un nuovo tentativo: senza questo, il riquadro
  // resterebbe in errore anche dopo un upload andato a buon fine, perché
  // React riusa lo stesso nodo <img> e lo stato d'errore sopravvive al
  // cambio di src.
  useEffect(() => { setLoadErr(false) }, [previewUrl])

  const doUpload = async (files) => {
    const file = files?.[0]
    if (!file) return
    // Subito, prima che l'upload parta: da qui in poi il riquadro mostra la
    // scelta appena fatta, qualunque cosa facciano Blob, GitHub e il deploy.
    setLocalPreview(URL.createObjectURL(file))
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
        {previewUrl && !loadErr
          ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover"
              onError={() => setLoadErr(true)} />
          )
          : previewUrl && loadErr
          ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center text-[9px] text-red-300 px-1 bg-red-950/40">
              <span className="text-sm leading-none">⚠</span>
              <span>immagine non trovata</span>
            </span>
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
        {loadErr && (
          <p className="text-xs text-red-400 mt-1 break-all">
            Anteprima non caricata: <code>{previewUrl}</code> — il file non esiste in{' '}
            <code>public/</code> su main, oppure il deploy che lo contiene non è ancora pronto.
          </p>
        )}
        {uploadErr && <p className="text-xs text-red-400 mt-1">{uploadErr}</p>}
      </div>
    </div>
  )
}
