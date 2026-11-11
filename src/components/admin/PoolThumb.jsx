import { sideOfMedia } from '@/lib/mediaKey'
// ── Miniatura del pool immagini — condivisa da Add Product (AdminPage) e Modify Product (AdminProductPage).
// Hover a thumbnail to give it a role (src/lib/productMedia.js):
//   ★ Hero      — video hero (videoUrl) o foto hero (heroShots, max 2): Objects + apertura scheda
//   # Mockup    — galleria del catalogo, in ordine (mockup 1 = dopo il video)
//   🔍 Dettaglio — "hold to reveal"
//   🏠 Lifestyle — solo nelle sezioni a foto piena della home (heroImage)

export const MAX_HERO_SHOTS = 2

export default function PoolThumb({ img, heroShots, heroVideo, mobileHero, sequenza, detailImage, imageSides = {}, onSetImageSide, onToggleHeroShot, onSetHeroVideo, onSetMobileHero, onToggleSequenza, onSetDetailImage, onDeleteImage }) {
  const url      = img.url
  const isVid    = /\.(mp4|mov|webm)$/i.test(url)
  const shotIdx  = heroShots.indexOf(url)
  const isHero   = isVid ? heroVideo === url : shotIdx !== -1
  const isLife   = mobileHero   === url
  const isDetail = detailImage  === url
  const side     = sideOfMedia(imageSides, url)  // 'front' | 'back' | null
  const seqIdx   = sequenza.indexOf(url)
  const inSeq    = seqIdx !== -1
  const canDel   = !!img.path && !!onDeleteImage  // only GitHub-stored images (uploaded/generated) can be deleted
  const heroFull = !isVid && !isHero && heroShots.length >= MAX_HERO_SHOTS
  const btn = (on, onCls) => `w-7 h-5 text-[9px] font-bold flex items-center justify-center rounded-sm border transition-colors ${
    on ? onCls : 'bg-gray-900 border-gray-600 hover:border-gray-400 text-gray-300'
  }`
  return (
    <div className="relative group flex-shrink-0 w-16 h-16">
      <div className={`w-full h-full border-2 overflow-hidden transition-all ${
        isHero ? 'border-yellow-400' : isDetail ? 'border-amber-600' : isLife ? 'border-purple-500' : inSeq ? 'border-emerald-700' : 'border-gray-700'
      }`}>
        {isVid
          ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          : <img src={url} alt={img.name} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.opacity = '0.3' }} />
        }
      </div>
      {/* Role badges */}
      {isHero   && <div className="absolute top-0 left-0 bg-yellow-400 text-black text-[8px] px-0.5 py-px font-bold leading-none pointer-events-none z-10">★{isVid ? ' 🎬' : shotIdx + 1}</div>}
      {isLife   && <div className="absolute top-0 right-0 bg-purple-600 text-white text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">🏠</div>}
      {isDetail && <div className="absolute bottom-0 right-0 bg-amber-500 text-black text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">🔍</div>}
      {inSeq    && <div className="absolute bottom-0 left-0 bg-emerald-700 text-white text-[8px] px-1 py-px font-bold leading-none pointer-events-none z-10">{seqIdx + 1}</div>}
      {side && <div className={`absolute top-1/2 -translate-y-1/2 left-0 text-[8px] px-1 py-px font-bold leading-none pointer-events-none z-10 ${side === 'front' ? 'bg-sky-500 text-black' : 'bg-orange-500 text-black'}`}>{side === 'front' ? 'F' : 'B'}</div>}
      {isVid && !isHero && <div className="absolute bottom-0 left-0 bg-gray-800 text-white text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">🎬</div>}
      {/* Hover action overlay — role buttons + delete */}
      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-between py-1 z-20">
        {isVid ? (
          <button onClick={() => onSetHeroVideo(isHero ? '' : url)} title={isHero ? 'Togli come video hero' : 'Video hero (Objects + apertura scheda)'}
            className={`${btn(isHero, 'bg-yellow-400 border-yellow-300 text-black')} w-14`}>★ hero</button>
        ) : (
          <div className="grid grid-cols-2 gap-0.5">
            <button onClick={() => !heroFull && onToggleHeroShot(url)} disabled={heroFull}
              title={heroFull ? `Già ${MAX_HERO_SHOTS} foto hero` : isHero ? 'Togli dalle foto hero' : 'Foto hero (senza video: apre la scheda e sta su Objects)'}
              className={`${btn(isHero, 'bg-yellow-400 border-yellow-300 text-black')} ${heroFull ? 'opacity-30' : ''}`}>★</button>
            <button onClick={() => onToggleSequenza(url)} title={inSeq ? 'Togli dai mockup' : 'Aggiungi ai mockup (galleria)'}
              className={btn(inSeq, 'bg-emerald-700 border-emerald-600 text-white')}>{inSeq ? seqIdx + 1 : '#'}</button>
            <button onClick={() => onSetDetailImage(isDetail ? null : url)} title="Dettaglio (hold to reveal)"
              className={btn(isDetail, 'bg-amber-500 border-amber-400 text-black')}>🔍</button>
            <button onClick={() => onSetMobileHero(isLife ? null : url)} title="Lifestyle home (sezioni a foto piena)"
              className={btn(isLife, 'bg-purple-600 border-purple-500')}>🏠</button>
            {/* Lato in scheda: B = solo con "Back", F = solo con "Front". */}
            <button onClick={() => onSetImageSide?.(url, side === 'back' ? null : 'back')} title={side === 'back' ? 'Togli: mostra su entrambi i lati' : 'Solo su Back'}
              className={btn(side === 'back', 'bg-orange-500 border-orange-400 text-black')}>B</button>
            <button onClick={() => onSetImageSide?.(url, side === 'front' ? null : 'front')} title={side === 'front' ? 'Togli: mostra su entrambi i lati' : 'Solo su Front'}
              className={btn(side === 'front', 'bg-sky-500 border-sky-400 text-black')}>F</button>
          </div>
        )}
        {/* Row 2: delete (only for GitHub images) */}
        {canDel && (
          <button
            onClick={() => onDeleteImage(img)}
            title="Elimina"
            className="w-full text-[9px] font-bold text-red-400 hover:bg-red-900/40 transition-colors py-0.5 text-center border-t border-gray-700/50"
          >✕ elimina</button>
        )}
      </div>
    </div>
  )
}
