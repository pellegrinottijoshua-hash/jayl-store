import { useRef, useState, useCallback } from 'react'
import { PRINT_CANVAS, PLACEMENT_SPECS, defaultTransform, clampTransform } from '@/lib/printCanvas'

// ── Editor di posizionamento della stampa ────────────────────────────────────
// Prima di questo componente il fitting era fisso: PLACEMENT_SPECS decideva
// larghezza/posizione una volta sola, e l'unica scelta dell'operatore era
// accettarlo o caricare il file "as-is" (checkbox "Adatta automaticamente").
// Qui l'operatore trascina l'arte per spostarla e usa lo slider per
// ingrandirla/rimpicciolirla, con anteprima dal vivo — poi conferma, ed è a
// quel punto (non prima) che si compone il PNG finale a piena risoluzione.
//
// L'anteprima è CSS puro (percentuali su un <img> posizionato assolutamente
// dentro un contenitore con lo stesso aspect ratio del canvas 3661×4843), non
// un ridisegno di canvas a ogni frame di drag — identica matematica del
// render finale (renderToCanvas in printCanvas.js legge le stesse percentuali),
// solo molto più leggera da animare mentre l'operatore trascina.
export default function PrintPlacementEditor({
  art,             // offscreen canvas da extractArt() — ha .width/.height ed è disegnabile
  initialTransform,
  placementType,   // 'back' | 'default' — per l'etichetta e il reset
  onConfirm,       // (transform) => void
  onCancel,
  busy = false,
}) {
  const [transform, setTransform] = useState(initialTransform)
  const containerRef = useRef(null)
  const dragRef = useRef(null) // {startX, startY, startLeftPct, startTopPct, rectW, rectH}

  const artUrl = useRef(art.toDataURL ? art.toDataURL('image/png') : null).current

  const handlePointerDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startLeftPct: transform.leftPct, startTopPct: transform.topPct,
      rectW: rect.width, rectH: rect.height,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [transform.leftPct, transform.topPct])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return
    const { startX, startY, startLeftPct, startTopPct, rectW, rectH } = dragRef.current
    const dxPct = (e.clientX - startX) / rectW
    const dyPct = (e.clientY - startY) / rectH
    setTransform((t) => clampTransform({ ...t, leftPct: startLeftPct + dxPct, topPct: startTopPct + dyPct }))
  }, [])

  const handlePointerUp = useCallback((e) => {
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }
  }, [])

  // Larghezza via slider — l'altezza segue le proporzioni reali dell'arte,
  // stessa logica di defaultTransform, così ridimensionare non deforma mai il
  // disegno. Riclampata subito dopo: crescere può spingere il bordo fuori dal
  // canvas se l'arte era già vicina a un lato.
  const artAspect = art.height / art.width
  const handleWidthChange = (pct) => {
    const widthPct  = pct / 100
    const heightPct = widthPct * (PRINT_CANVAS.w / PRINT_CANVAS.h) * artAspect
    setTransform((t) => clampTransform({ ...t, widthPct, heightPct }))
  }

  const handleReset = () => setTransform(clampTransform(defaultTransform(placementType, artAspect)))

  const label = PLACEMENT_SPECS[placementType]?.label || PLACEMENT_SPECS.default.label

  return (
    <div className="rounded border border-indigo-800/60 bg-indigo-950/20 p-3 space-y-3">
      <p className="text-indigo-300 font-semibold text-xs">
        Posiziona la stampa — {placementType === 'back' ? 'RETRO' : 'FRONTE'} · {label}
      </p>

      <div className="flex gap-4">
        {/* Canvas interattivo — stesso aspect ratio di PRINT_CANVAS (3661×4843) */}
        <div
          ref={containerRef}
          className="relative shrink-0 overflow-hidden border border-dashed border-indigo-700/60 bg-[repeating-conic-gradient(#222_0_25%,#2c2c2c_0_50%)] bg-[length:16px_16px] touch-none select-none"
          style={{ width: 170, height: 170 * (PRINT_CANVAS.h / PRINT_CANVAS.w) }}
        >
          <img
            src={artUrl}
            alt="Arte da posizionare"
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute cursor-move"
            style={{
              left:   `${transform.leftPct * 100}%`,
              top:    `${transform.topPct * 100}%`,
              width:  `${transform.widthPct * 100}%`,
              height: `${transform.heightPct * 100}%`,
            }}
          />
        </div>

        <div className="flex-1 min-w-0 text-xs space-y-2">
          <p className="text-gray-500">Trascina l'arte per spostarla.</p>

          <label className="block">
            <span className="flex justify-between text-gray-500 mb-1">
              <span>Dimensione</span>
              <span className="font-mono text-gray-400">{Math.round(transform.widthPct * 100)}%</span>
            </span>
            <input
              type="range" min="5" max="100" step="1"
              value={Math.round(transform.widthPct * 100)}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </label>

          <p className="text-gray-500">
            Sul canvas: {Math.round(transform.widthPct * PRINT_CANVAS.w)}×{Math.round(transform.heightPct * PRINT_CANVAS.h)}
            {' · '}x {Math.round(transform.leftPct * 100)}% · y {Math.round(transform.topPct * 100)}%
          </p>

          <div className="flex gap-2 flex-wrap pt-1">
            <button
              onClick={() => onConfirm(transform)}
              disabled={busy}
              className="bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 transition-colors"
            >
              {busy ? '⏫ Caricamento…' : '✓ Conferma e carica'}
            </button>
            <button
              onClick={handleReset}
              disabled={busy}
              className="border border-gray-700 hover:border-gray-500 text-gray-400 text-xs px-3 py-1.5 transition-colors disabled:opacity-40"
            >
              ↺ Posizione consigliata
            </button>
            <button
              onClick={onCancel}
              disabled={busy}
              className="text-gray-500 hover:text-red-400 text-xs px-2 disabled:opacity-40"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
