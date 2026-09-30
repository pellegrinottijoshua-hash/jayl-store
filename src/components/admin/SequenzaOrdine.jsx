import { useState } from 'react'

/**
 * La sequenza delle immagini della scheda prodotto, e il suo ordine.
 *
 * Tre modi di riordinare, dal piu' veloce:
 *  - "Ordina cliccando": si cliccano le immagini nell'ordine voluto (1, 2, 3…);
 *    quelle non cliccate restano in coda, nell'ordine di prima.
 *  - trascinare un'immagine sopra un'altra: prende il suo posto.
 *  - "1°" su un'immagine: diventa la prima.
 * ‹ › restano per lo spostamento di un posto, ✕ la toglie dalla sequenza.
 *
 * Usato da AdminPage (modulo Add/Edit) e da AdminProductPage (editor completo):
 * prima ognuno aveva la sua striscia, solo con ‹ ›.
 */
export default function SequenzaOrdine({ sequenza, onChange, desktopHero, mobileHero }) {
  const [trascinata, setTrascinata] = useState(null)
  const [sopra, setSopra] = useState(null)
  const [cliccando, setCliccando] = useState(false)
  const [scelte, setScelte] = useState([])

  const sposta = (da, a) => {
    if (da === a || da == null || a == null) return
    const s = [...sequenza]
    const [x] = s.splice(da, 1)
    s.splice(a, 0, x)
    onChange(s)
  }
  const chiudiClic = (applica) => {
    if (applica && scelte.length) onChange([...scelte, ...sequenza.filter((u) => !scelte.includes(u))])
    setScelte([])
    setCliccando(false)
  }

  if (!sequenza.length) {
    return <p className="text-gray-600 text-xs py-2">Nessuna immagine — usa + nel pool per aggiungere.</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {cliccando ? (
          <>
            <span className="text-emerald-400 text-xs">
              Clicca le immagini nell'ordine in cui le vuoi · {scelte.length}/{sequenza.length}
            </span>
            <button type="button" onClick={() => chiudiClic(true)} disabled={!scelte.length}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs px-2.5 py-1 transition-colors">
              ✓ Fatto
            </button>
            <button type="button" onClick={() => chiudiClic(false)} className="text-gray-500 hover:text-gray-300 text-xs px-1">
              Annulla
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setCliccando(true)}
            className="border border-emerald-800 hover:border-emerald-600 text-emerald-400 text-xs px-2.5 py-1 transition-colors">
            🔢 Ordina cliccando
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {sequenza.map((url, i) => {
          const isVideo = /\.(mp4|mov|webm)$/i.test(url)
          const nuovo = scelte.indexOf(url)
          return (
            <div
              key={url}
              draggable={!cliccando}
              onDragStart={(e) => { setTrascinata(i); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); if (sopra !== i) setSopra(i) }}
              onDragLeave={() => setSopra((s) => (s === i ? null : s))}
              onDrop={(e) => { e.preventDefault(); sposta(trascinata, i); setTrascinata(null); setSopra(null) }}
              onDragEnd={() => { setTrascinata(null); setSopra(null) }}
              onClick={() => {
                if (!cliccando) return
                setScelte((s) => (s.includes(url) ? s.filter((u) => u !== url) : [...s, url]))
              }}
              className={`relative group w-20 h-20 border-2 bg-black select-none transition-all ${
                cliccando ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
              } ${sopra === i && trascinata !== i ? 'border-emerald-400 scale-105' : trascinata === i ? 'border-gray-500 opacity-40' : 'border-gray-700'} ${
                cliccando && nuovo === -1 ? 'opacity-50' : ''
              }`}
              title={cliccando ? 'Clicca per dare la prossima posizione' : 'Trascina per spostare'}
            >
              {isVideo
                ? <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>
                : <img src={url} alt={`immagine ${i + 1}`} draggable={false} className="w-full h-full object-cover pointer-events-none" />}

              <span className="absolute top-0 left-0 bg-emerald-600 text-white text-[10px] font-bold px-1 leading-tight">{i + 1}</span>
              {cliccando && nuovo !== -1 && (
                <span className="absolute inset-0 flex items-center justify-center bg-emerald-900/60 text-white text-2xl font-bold">{nuovo + 1}</span>
              )}
              {desktopHero === url && <span className="absolute top-0.5 right-0.5 bg-blue-600/90 text-white text-[8px] px-0.5 leading-none pointer-events-none">🖥</span>}
              {mobileHero === url && <span className="absolute bottom-5 right-0.5 bg-purple-600/90 text-white text-[8px] px-0.5 leading-none pointer-events-none">📱</span>}

              {!cliccando && (
                <>
                  <button type="button" onClick={() => onChange(sequenza.filter((_, j) => j !== i))} title="Togli dalla sequenza"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-700 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] leading-none opacity-0 group-hover:opacity-100 transition-opacity z-20">×</button>
                  <div className="absolute bottom-0 inset-x-0 flex bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => sposta(i, i - 1)} disabled={i === 0} title="Un posto a sinistra"
                      className="flex-1 text-white text-sm py-0.5 disabled:opacity-20 hover:bg-white/20">‹</button>
                    <button type="button" onClick={() => sposta(i, 0)} disabled={i === 0} title="Metti per prima"
                      className="flex-1 text-white text-[10px] py-0.5 disabled:opacity-20 hover:bg-white/20">1°</button>
                    <button type="button" onClick={() => sposta(i, i + 1)} disabled={i === sequenza.length - 1} title="Un posto a destra"
                      className="flex-1 text-white text-sm py-0.5 disabled:opacity-20 hover:bg-white/20">›</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-gray-600 text-[10px]">
        Trascina per spostare · "1°" la mette per prima · è l'ordine in cui le immagini appaiono sulla scheda prodotto.
      </p>
    </div>
  )
}
