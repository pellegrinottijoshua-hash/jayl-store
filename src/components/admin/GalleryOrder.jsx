import { useState } from 'react'
import { mediaKey, sideOfMedia } from '@/lib/mediaKey'

// L'ordine dei mockup nella scheda prodotto (`images`), modificabile a mano:
// si trascina una foto sopra un'altra, oppure ◀ ▶ (un posto) e «2ª».
// La 1ª e' la copertina; la 2ª e' anche quella che la home Zack mostra col
// tasto ↺ (il lato liscio). Con i lati F/B la scheda mostra, per ogni lato, le
// foto senza lato e poi quelle del lato: numeri e frecce contano per lato
// (F2 = seconda sotto Front, B2 = seconda sotto Back).
export default function GalleryOrder({ sequenza, imageSides, onReorder, onRemove }) {
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  if (!sequenza.length) return <p className="text-[10px] text-gray-700 italic">Nessun mockup: aggiungili col tasto # nel pool.</p>

  const sideOf = (u) => sideOfMedia(imageSides, u)
  const hasSides = sequenza.some((u) => sideOf(u))
  const group = (u) => sideOf(u) || 'all'
  const neutral = sequenza.filter((u) => !sideOf(u))
  const sameGroup = (u) => sequenza.filter((x) => group(x) === group(u))
  const label = (u) => {
    const k = sameGroup(u).indexOf(u) + 1
    if (!hasSides) return `${k}`
    const s = sideOf(u)
    return s ? `${s === 'front' ? 'F' : 'B'}${neutral.length + k}` : `F/B${k}`
  }

  // Sposta `u` al posto di `target` nell'elenco intero.
  const moveTo = (u, target) => {
    if (!u || !target || mediaKey(u) === mediaKey(target)) return
    const next = sequenza.filter((x) => x !== u)
    const to = next.indexOf(target) + (sequenza.indexOf(u) < sequenza.indexOf(target) ? 1 : 0)
    next.splice(to, 0, u)
    onReorder(next)
  }
  // Un posto avanti o indietro fra le foto dello stesso lato.
  const step = (u, dir) => {
    const g = sameGroup(u), i = g.indexOf(u)
    const other = g[i + dir]
    if (!other) return
    const next = sequenza.slice()
    const a = next.indexOf(u), b = next.indexOf(other)
    next[a] = other; next[b] = u
    onReorder(next)
  }
  // Seconda del suo lato: subito dopo la prima.
  const second = (u) => {
    const g = sameGroup(u)
    if (g.indexOf(u) === 1 || g.length < 2) return
    const first = g[0] === u ? g[1] : g[0]
    const next = sequenza.filter((x) => x !== u)
    next.splice(next.indexOf(first) + 1, 0, u)
    onReorder(next)
  }

  const arrow = 'w-5 h-5 text-[10px] leading-none flex items-center justify-center rounded-sm border border-gray-600 bg-gray-900 text-gray-200 hover:border-gray-300 disabled:opacity-25'
  return (
    <div className="flex flex-wrap gap-1.5">
      {sequenza.map((u) => {
        const g = sameGroup(u), i = g.indexOf(u), s = sideOf(u)
        return (
          <div key={u} draggable
            onDragStart={(e) => { setDrag(u); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); if (over !== u) setOver(u) }}
            onDragLeave={() => setOver((o) => (o === u ? null : o))}
            onDrop={(e) => { e.preventDefault(); moveTo(drag, u); setDrag(null); setOver(null) }}
            onDragEnd={() => { setDrag(null); setOver(null) }}
            className={`relative group w-14 h-14 flex-shrink-0 border-2 cursor-grab active:cursor-grabbing transition-colors ${
              over === u && drag !== u ? 'border-indigo-400' : i === 1 ? 'border-emerald-500' : 'border-gray-700'
            } ${drag === u ? 'opacity-40' : ''}`}
            title={i === 1 ? '2ª foto: anche il lato che la home Zack mostra col tasto ↺' : 'Trascina per spostare'}>
            {/\.(mp4|mov|webm)$/i.test(u)
              ? <video src={`${u}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" />
              : <img src={u} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />}
            <span className={`absolute top-0 left-0 text-[8px] px-0.5 py-px font-bold leading-none ${
              s === 'front' ? 'bg-sky-500 text-black' : s === 'back' ? 'bg-orange-500 text-black' : 'bg-emerald-700 text-white'
            }`}>{label(u)}</span>
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-px p-px bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" className={arrow} disabled={i === 0} onClick={() => step(u, -1)} title="Un posto prima">◀</button>
              <button type="button" className={arrow} disabled={i === 1 || g.length < 2} onClick={() => second(u)} title="Mettila seconda">2ª</button>
              <button type="button" className={arrow} disabled={i === g.length - 1} onClick={() => step(u, 1)} title="Un posto dopo">▶</button>
            </div>
            <button type="button" onClick={() => onRemove(u)} title="Togli dalla galleria"
              className="absolute top-0 right-0 w-4 h-4 text-[9px] leading-none bg-black/80 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
          </div>
        )
      })}
    </div>
  )
}
