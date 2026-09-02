import { useEffect, useState } from 'react'
import { products as allProducts } from '@/data/products-full'
import { getAdminPassword } from '@/components/generate-assets/constants'

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

  const save = async () => {
    // Difesa in profondità: anche se il campo è rimasto vuoto o invalido al
    // momento del salvataggio, non mandiamo mai un cap <= 0 al server.
    const capNum  = parseInt(cfg.current.cap, 10)
    const safeCap = Number.isFinite(capNum) && capNum > 0 ? capNum : 1
    const toSave  = { ...cfg, current: { ...cfg.current, cap: safeCap } }
    if (safeCap !== cfg.current.cap) setCurrent({ cap: safeCap })

    setMsg('Salvataggio…')
    const r = await post('save-drop', { drop: toSave, sha })
    setMsg(r.ok ? 'Salvato — il deploy parte da solo' : (r.error || 'errore'))
  }

  const closeDrop = async () => {
    if (!confirm('Chiudere il drop? I pezzi passano in listino a prezzo pieno.')) return
    setMsg('Chiusura…')
    const r = await post('close-drop')
    setMsg(r.ok ? 'Drop chiuso' : (r.error || 'errore'))
    if (r.ok) loadDrop()
  }

  const release = async (id) => {
    const r = await post('release-product', { productId: id })
    if (r.ok) setCfg((c) => ({ ...c, released: r.released }))
    else setMsg(r.error || 'errore')
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

      <section className="flex gap-3 items-center flex-wrap">
        <button onClick={save} className="px-4 py-2 bg-white text-black rounded text-sm">Salva</button>
        <button onClick={closeDrop} className="px-4 py-2 border border-red-700 text-red-400 rounded text-sm">
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
                <button onClick={() => release(p.id)} className="text-xs underline hover:text-white">
                  Attiva in listino
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
