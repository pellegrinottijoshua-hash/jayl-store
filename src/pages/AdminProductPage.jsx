import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { upload as blobUpload } from '@vercel/blob/client'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
// Full catalog incl. Etsy/Pinterest/Gelato fields — the storefront copy is stripped
import { products as allProducts } from '@/data/products-full'
import GenerateAssetsTab from '@/components/GenerateAssetsTab'
import { fitDesignToCanvas, detectPlacement, PRINT_CANVAS, PLACEMENT_SPECS } from '@/lib/printCanvas'
import SocialShareButtons from '@/components/SocialShareButtons'

const getAdminPassword = () => sessionStorage.getItem('jaylAdminPw') || ''
const JAYL_NECK_LABEL_URL = 'https://raw.githubusercontent.com/pellegrinottijoshua-hash/jayl-store/main/public/designs/jayl-neck-label.svg'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = cents => `€${(cents / 100).toFixed(2)}`
const sanitizeFilename = name => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

function parseVideoUrl(url) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/)
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return { type: 'vimeo', id: vmMatch[1] }
  if (/\.mp4$/i.test(url)) return { type: 'mp4', src: url }
  return null
}

async function api(action, data, signal) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: getAdminPassword(), ...data }),
    ...(signal ? { signal } : {}),
  })
  let json
  try { json = await res.json() }
  catch { throw new Error(`Errore server (${res.status}) — verifica che GITHUB_TOKEN sia configurato su Vercel`) }
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Compress an image file so it fits inside the 3.5 MB base64 limit.
// Videos are returned unchanged (can't compress in the browser).
// Falls back to the original file on any error.
function compressImage(file, maxMB = 3.2) {
  if (!file.type.startsWith('image/')) return Promise.resolve(file)
  if (file.size <= maxMB * 1024 * 1024) return Promise.resolve(file)
  return new Promise(resolve => {
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
        canvas.toBlob(blob => {
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

// ── Video compression (ffmpeg.wasm single-threaded, no COOP/COEP needed) ─────
// Lazily loads the WASM core from CDN on first use.
let _ffmpeg = null
let _ffmpegLoading = false
let _ffmpegCallbacks = []

async function ensureFFmpeg(onLog) {
  if (_ffmpeg) return _ffmpeg
  if (_ffmpegLoading) {
    return new Promise((resolve, reject) => {
      _ffmpegCallbacks.push({ resolve, reject })
    })
  }
  _ffmpegLoading = true
  try {
    const ff = new FFmpeg()
    if (onLog) ff.on('log', ({ message }) => onLog(message))
    const baseURL = 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm'
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    _ffmpeg = ff
    _ffmpegCallbacks.forEach(cb => cb.resolve(ff))
    return ff
  } catch (err) {
    _ffmpegCallbacks.forEach(cb => cb.reject(err))
    throw err
  } finally {
    _ffmpegLoading = false
    _ffmpegCallbacks = []
  }
}

async function compressVideo(file, maxMB = 2.5, onProgress, onStatus) {
  if (!/\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name)) return file
  if (file.size <= maxMB * 1024 * 1024) return file

  onStatus?.('Caricamento codec video…')
  const ff = await ensureFFmpeg()

  const ext   = file.name.match(/\.[^.]+$/)?.[0] ?? '.mp4'
  const inFile  = `input${ext}`
  const outFile = 'output.mp4'

  ff.on('progress', ({ progress }) => onProgress?.(Math.round(progress * 100)))

  onStatus?.('Compressione video…')
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec([
    '-i', inFile,
    '-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '30',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    '-y', outFile,
  ])

  const data = await ff.readFile(outFile)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  ff.off('progress')

  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const result   = new File([blob], `${baseName}.mp4`, { type: 'video/mp4' })

  onStatus?.(`Compresso: ${(result.size / 1024 / 1024).toFixed(1)} MB`)
  // Return compressed only if smaller
  return result.size < file.size ? result : file
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-[#111] border border-[#1e1e1e] text-[#e8dcc8] px-3 py-2 text-sm focus:outline-none focus:border-[#c8b89a] transition-colors placeholder:text-[#555]'
const btnPrimary = 'bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer'
const btnDanger  = 'bg-red-900/70 hover:bg-red-800 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnGhost   = 'border border-amber-900/60 hover:border-amber-600 text-amber-700/80 hover:text-amber-400 px-3 py-1.5 text-xs transition-colors cursor-pointer'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[#888] text-xs mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[#666] text-xs mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, icon, color = 'gray', children }) {
  const colors = {
    gray:    { border: 'border-gray-700',    text: 'text-gray-400',    bg: 'bg-gray-900/30' },
    amber:   { border: 'border-amber-700',   text: 'text-amber-400',   bg: 'bg-amber-950/20' },
    emerald: { border: 'border-emerald-800', text: 'text-emerald-500', bg: 'bg-emerald-950/10' },
    sky:     { border: 'border-sky-800',     text: 'text-sky-500',     bg: 'bg-sky-950/10' },
    blue:    { border: 'border-blue-800',    text: 'text-blue-400',    bg: 'bg-blue-950/10' },
    orange:  { border: 'border-orange-800',  text: 'text-orange-400',  bg: 'bg-orange-950/10' },
    red:     { border: 'border-red-800',     text: 'text-red-400',     bg: 'bg-red-950/10' },
    fuchsia: { border: 'border-gray-600',    text: 'text-gray-400',    bg: 'bg-gray-900/20' },
    teal:    { border: 'border-teal-800',    text: 'text-teal-400',    bg: 'bg-teal-950/10' },
  }
  const c = colors[color] || colors.gray
  return (
    <div className={`border-l-2 ${c.border} pl-4 py-1`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
        {icon && <span className="text-base">{icon}</span>}
        <h3 className={`text-xs font-semibold uppercase tracking-widest ${c.text}`}>{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// ── Image Pool — left column ───────────────────────────────────────────────────
// Shows ALL image sources: Gelato defaults, uploaded externals, AI-generated.
// Hover each thumbnail to assign it as Hero Desktop/Mobile or add to Sequenza.

function PoolThumb({ img, desktopHero, mobileHero, sequenza, detailImage, onSetDesktopHero, onSetMobileHero, onToggleSequenza, onSetDetailImage, onDeleteImage }) {
  const url      = img.url
  const isDesk   = desktopHero  === url
  const isMob    = mobileHero   === url
  const isDetail = detailImage  === url
  const seqIdx   = sequenza.indexOf(url)
  const inSeq    = seqIdx !== -1
  const isVid    = /\.(mp4|mov|webm)$/i.test(url)
  const canDel   = !!img.path  // only GitHub-stored images (uploaded/generated) can be deleted
  return (
    <div className="relative group flex-shrink-0 w-16 h-16">
      <div className={`w-full h-full border-2 overflow-hidden transition-all ${
        isDetail ? 'border-amber-400' : isDesk ? 'border-blue-500' : isMob ? 'border-purple-500' : inSeq ? 'border-emerald-700' : 'border-gray-700'
      }`}>
        {isVid
          ? <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl">🎬</div>
          : <img src={url} alt={img.name} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.opacity = '0.3' }} />
        }
      </div>
      {/* Role badges */}
      {isDesk   && <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">🖥</div>}
      {isMob    && <div className="absolute top-0 right-0 bg-purple-600 text-white text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">📱</div>}
      {isDetail && <div className="absolute bottom-0 right-0 bg-amber-500 text-black text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">🔍</div>}
      {inSeq    && <div className="absolute bottom-0 left-0 bg-gray-700 text-white text-[8px] px-1 py-px font-bold leading-none pointer-events-none z-10">{seqIdx + 1}</div>}
      {/* Hover action overlay — 2 rows: top (assign) + bottom (delete) */}
      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-between py-1 z-20">
        {/* 2×2 grid of assign buttons — fits any thumbnail width */}
        <div className="grid grid-cols-2 gap-0.5">
          <button onClick={() => onSetDesktopHero(isDesk ? null : url)} title="Hero Desktop 16:9"
            className={`w-7 h-5 text-[9px] flex items-center justify-center rounded-sm border transition-colors ${
              isDesk ? 'bg-blue-600 border-blue-500' : 'bg-gray-900 border-gray-600 hover:border-blue-500'
            }`}>🖥</button>
          <button onClick={() => onSetMobileHero(isMob ? null : url)} title="Hero Mobile 9:16"
            className={`w-7 h-5 text-[9px] flex items-center justify-center rounded-sm border transition-colors ${
              isMob ? 'bg-purple-600 border-purple-500' : 'bg-gray-900 border-gray-600 hover:border-purple-500'
            }`}>📱</button>
          <button onClick={() => onToggleSequenza(url)} title={inSeq ? 'Rimuovi da sequenza' : 'Aggiungi a sequenza'}
            className={`w-7 h-5 text-[9px] font-bold flex items-center justify-center rounded-sm border transition-colors ${
              inSeq ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-gray-900 border-gray-600 hover:border-emerald-600 text-gray-300'
            }`}>{inSeq ? '✓' : '+'}</button>
          <button onClick={() => onSetDetailImage(isDetail ? null : url)} title="Immagine dettaglio (Hold to reveal)"
            className={`w-7 h-5 text-[9px] flex items-center justify-center rounded-sm border transition-colors ${
              isDetail ? 'bg-amber-500 border-amber-400 text-black' : 'bg-gray-900 border-gray-600 hover:border-amber-400 text-gray-300'
            }`}>🔍</button>
        </div>
        {/* Row 2: delete (only for GitHub images) */}
        {canDel && (
          <button
            onClick={() => onDeleteImage(img)}
            title="Elimina immagine"
            className="w-full text-[9px] font-bold text-red-400 hover:bg-red-900/40 transition-colors py-0.5 text-center border-t border-gray-700/50"
          >✕ elimina</button>
        )}
      </div>
    </div>
  )
}

function ImagePool({
  gelatoImages, uploadedImages, generatedImages,
  desktopHero, mobileHero, sequenza, detailImage,
  onSetDesktopHero, onSetMobileHero, onToggleSequenza, onSetDetailImage,
  productId, onUploaded, loading, onExcludeGelato,
}) {
  const [uploading,   setUploading]   = useState(false)
  const [uploadErr,   setUploadErr]   = useState('')
  const [dragging,    setDragging]    = useState(false)
  const fileRef = useRef()

  const [videoProgress, setVideoProgress] = useState(0)
  const [videoStatus,   setVideoStatus]   = useState('')

  const doUpload = useCallback(async files => {
    setUploading(true); setUploadErr(''); setVideoProgress(0); setVideoStatus('')
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(new Error('Timeout — operazione troppo lenta (>120s)')), 120_000)
    try {
      for (const raw of Array.from(files)) {
        const isRawVideo = /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(raw.name)
        let file

        if (isRawVideo) {
          // Compress video with ffmpeg.wasm if > 2.5 MB → store on GitHub via base64
          file = await compressVideo(
            raw, 2.5,
            pct => setVideoProgress(pct),
            msg => setVideoStatus(msg),
          )
        } else {
          file = await compressImage(raw)
        }
        setVideoProgress(0); setVideoStatus('')

        const filename = sanitizeFilename(file.name)
        const isVideo  = /\.(mp4|mov|webm)$/i.test(filename)
        const dataUrl  = await fileToBase64(file)
        await api('upload-image', { productId, filename, dataUrl, isVideo }, ctrl.signal)
      }
      onUploaded?.()
    } catch (e) {
      console.error('[ImagePool] upload error:', e)
      const msg = ctrl.signal.aborted
        ? (ctrl.signal.reason?.message || 'Timeout upload')
        : (e.message || String(e) || 'Errore upload sconosciuto')
      setUploadErr(msg)
    } finally {
      clearTimeout(timer)
      setUploading(false); setVideoProgress(0); setVideoStatus('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [productId, onUploaded])

  const handleDeleteImage = useCallback(async (img) => {
    // Gelato / external images have no GitHub path → they can't be deleted, only excluded from this product
    if (!img.path) {
      if (!window.confirm(`Rimuovere "${img.name}" dai mockup Gelato di questo prodotto?`)) return
      if (desktopHero === img.url)  onSetDesktopHero(null)
      if (mobileHero  === img.url)  onSetMobileHero(null)
      if (detailImage === img.url)  onSetDetailImage(null)
      if (sequenza.includes(img.url)) onToggleSequenza(img.url)
      onExcludeGelato?.(img.url)
      return
    }
    if (!window.confirm(`Eliminare "${img.name}"? L'azione è irreversibile.`)) return
    try {
      // Unassign from all roles before deleting
      if (desktopHero === img.url)  onSetDesktopHero(null)
      if (mobileHero  === img.url)  onSetMobileHero(null)
      if (detailImage === img.url)  onSetDetailImage(null)
      if (sequenza.includes(img.url)) onToggleSequenza(img.url)
      await api('delete-image', { path: img.path, sha: img.sha })
      onUploaded() // refresh pool
    } catch (e) {
      alert('Errore eliminazione: ' + e.message)
    }
  }, [desktopHero, mobileHero, detailImage, sequenza, onSetDesktopHero, onSetMobileHero, onSetDetailImage, onToggleSequenza, onUploaded, onExcludeGelato])

  const thumbProps = { desktopHero, mobileHero, sequenza, detailImage, onSetDesktopHero, onSetMobileHero, onToggleSequenza, onSetDetailImage, onDeleteImage: handleDeleteImage }

  const PoolSection = ({ label, images, emptyMsg }) => {
    if (!images?.length) return emptyMsg ? <p className="text-gray-700 text-[10px] italic">{emptyMsg}</p> : null
    return (
      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wider font-mono mb-1.5">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {images.map(img => <PoolThumb key={img.url} img={img} {...thumbProps} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div>
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden"
          onChange={e => doUpload(e.target.files)} />
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); doUpload(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed py-3 px-2 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-500 bg-[#1a1a0f]/30' : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          {uploading ? (
            <div className="space-y-1">
              <p className="text-amber-400 text-xs animate-pulse">
                {videoStatus || '⏫ Caricamento…'}
              </p>
              {videoProgress > 0 && (
                <div className="w-full bg-gray-700 h-1 rounded">
                  <div className="bg-amber-500 h-1 rounded transition-all" style={{ width: `${videoProgress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-xs">+ Importa immagine / video</p>
          )}
        </div>
        {uploadErr && <p className="text-red-400 text-xs mt-1">⚠ {uploadErr}</p>}
      </div>

      {loading && <p className="text-gray-600 text-xs">Caricamento…</p>}

      <PoolSection label="Gelato · Default" images={gelatoImages} />
      <PoolSection label="Importate" images={uploadedImages} emptyMsg="Nessuna importata ancora" />
      <PoolSection label="Generate" images={generatedImages} emptyMsg="Nessuna generata ancora" />

      {!loading && !gelatoImages?.length && !uploadedImages?.length && !generatedImages?.length && (
        <p className="text-gray-600 text-xs">Nessuna immagine ancora.</p>
      )}

      <p className="text-[9px] text-gray-700 leading-relaxed border-t border-gray-800 pt-2">
        Hover → 🖥 Hero Desktop &nbsp;·&nbsp; 📱 Hero Mobile &nbsp;·&nbsp; + Sequenza
      </p>
    </div>
  )
}

// ── Media Panel — Hero + Sequenza (controlled) ───────────────────────────────
// Purely display: all state lives in AdminProductPage.
// Assignment happens from PoolThumb hover buttons; this panel shows the result
// and lets the user reorder the sequenza with ‹ › arrows.

function MediaPanel({ desktopHero, mobileHero, sequenza, detailImage, allImages, onSetDesktopHero, onSetMobileHero, onSetDetailImage, onReorderSequenza, onSave, saving, msg }) {
  const moveLeft  = i => { if (i === 0) return; const s = [...sequenza]; [s[i-1],s[i]]=[s[i],s[i-1]]; onReorderSequenza(s) }
  const moveRight = i => { if (i === sequenza.length-1) return; const s = [...sequenza]; [s[i],s[i+1]]=[s[i+1],s[i]]; onReorderSequenza(s) }
  const getImg    = url => allImages?.find(i => i.url === url) || { url, name: url.split('/').pop().split('?')[0] || 'image' }

  const HeroSlot = ({ url, label, aspect, color, onClear }) => {
    const isVideo = url && /\.(mp4|mov|webm)$/i.test(url)
    return (
      <div>
        <p className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${color}`}>{label}</p>
        <div className={`w-full overflow-hidden border-2 flex items-center justify-center ${aspect} ${
          url
            ? (color === 'text-blue-400' ? 'border-blue-700' : 'border-purple-700')
            : 'border-dashed border-gray-700'
        }`}>
          {url ? (
            isVideo
              ? <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-1 text-gray-400">
                  <span className="text-2xl">🎬</span><span className="text-[10px]">video</span>
                </div>
              : <img src={url} alt="" className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.opacity = '0.3' }} />
          ) : (
            <span className="text-gray-600 text-xs">— non assegnato —</span>
          )}
        </div>
        {url && (
          <button onClick={onClear} className="text-[10px] text-gray-600 hover:text-red-400 mt-1 transition-colors">rimuovi</button>
        )}
      </div>
    )
  }

  return (
    <div className="border border-gray-800 bg-[#0a0a0a]">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
        <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">🎬 Hero & Sequenza</h3>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
          <button onClick={onSave} disabled={saving} className={`${btnPrimary} text-xs py-1`}>
            {saving ? 'Salvataggio…' : '💾 Salva'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* ── HERO ── */}
        <div>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-3">Hero</p>
          <div className="grid grid-cols-2 gap-4">
            <HeroSlot url={desktopHero} label="🖥 Desktop · 16:9" aspect="aspect-video" color="text-blue-400"
              onClear={() => onSetDesktopHero(null)} />
            <HeroSlot url={mobileHero} label="📱 Mobile · 9:16" aspect="aspect-[9/16] max-h-48" color="text-purple-400"
              onClear={() => onSetMobileHero(null)} />
          </div>
        </div>

        {/* ── DETAIL IMAGE ── */}
        <div>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-1">🔍 Immagine dettaglio</p>
          <p className="text-[10px] text-gray-700 mb-3">Visibile tenendo premuto "HOLD TO REVEAL" sulla pagina prodotto.</p>
          <div className="flex items-start gap-4">
            <div className="w-32 flex-shrink-0">
              <HeroSlot url={detailImage} label="" aspect="aspect-square" color="text-amber-400"
                onClear={() => onSetDetailImage(null)} />
            </div>
            <div className="text-[10px] text-gray-600 leading-relaxed pt-1">
              Usa il pulsante <span className="text-amber-400 font-bold">🔍</span> nel pool immagini<br/>
              per assegnare questa immagine.<br/>
              {!detailImage && <span className="text-gray-700 italic">Nessuna immagine — il tasto non apparirà.</span>}
              {detailImage && <span className="text-amber-400">✓ Dettaglio impostato</span>}
            </div>
          </div>
        </div>

        {/* ── SEQUENZA ── */}
        <div>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-3">
            Sequenza{sequenza.length > 0 ? ` · ${sequenza.length} immagini` : ''}
          </p>
          {sequenza.length === 0 ? (
            <p className="text-gray-600 text-xs py-2">Nessuna immagine — usa + nel pool per aggiungere.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {sequenza.map((url, i) => {
                const img       = getImg(url)
                const isDesktop = desktopHero === url
                const isMobile  = mobileHero  === url
                const isVideo   = /\.(mp4|mov|webm)$/i.test(url)
                return (
                  <div key={url} className="flex-shrink-0 relative group">
                    <div className={`w-20 h-20 border-2 overflow-hidden transition-all ${
                      isDesktop && isMobile ? 'border-indigo-500'
                        : isDesktop ? 'border-blue-600'
                        : isMobile  ? 'border-purple-600'
                        : 'border-gray-700'
                    }`}>
                      {isVideo
                        ? <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl">🎬</div>
                        : <img src={url} alt={img.name} className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                      }
                    </div>
                    {/* Position badge */}
                    <div className={`absolute -top-1.5 -left-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-sm ${
                      i === 0 ? 'bg-gray-500 text-white' : 'bg-gray-800 text-gray-400'
                    }`}>{i + 1}</div>
                    {/* Hero badges */}
                    {isDesktop && <div className="absolute top-0.5 right-0.5 bg-blue-600/90 text-white text-[8px] px-0.5 py-0.5 leading-none pointer-events-none">🖥</div>}
                    {isMobile  && <div className="absolute bottom-0.5 right-0.5 bg-purple-600/90 text-white text-[8px] px-0.5 py-0.5 leading-none pointer-events-none">📱</div>}
                    {/* Remove button */}
                    <button
                      onClick={() => onReorderSequenza(sequenza.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-700 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] leading-none opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      title="Rimuovi dalla sequenza"
                    >×</button>
                    {/* Reorder controls */}
                    <div className="absolute bottom-0 inset-x-0 flex opacity-0 group-hover:opacity-100 transition-opacity bg-black/70">
                      <button onClick={() => moveLeft(i)} disabled={i === 0}
                        className="flex-1 text-white text-sm py-0.5 disabled:opacity-20 hover:bg-white/20 transition-colors" title="Sposta a sinistra">‹</button>
                      <button onClick={() => moveRight(i)} disabled={i === sequenza.length - 1}
                        className="flex-1 text-white text-sm py-0.5 disabled:opacity-20 hover:bg-white/20 transition-colors" title="Sposta a destra">›</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {sequenza.length > 0 && (
            <p className="text-gray-700 text-[10px] mt-2">Hover → ‹ › riordina · 🖥 hero desktop · 📱 hero mobile</p>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Remove Background ─────────────────────────────────────────────────────────

function RemoveBackground() {
  const [previewUrl,  setPreviewUrl]  = useState(null)  // source image preview
  const [inputUrl,    setInputUrl]    = useState('')
  const [useUrl,      setUseUrl]      = useState(false)
  const [processing,  setProcessing]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [dragging,    setDragging]    = useState(false)
  const [downloaded,  setDownloaded]  = useState(false)
  const inputRef = useRef()
  const imageDataRef = useRef(null) // holds base64 data URL

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      imageDataRef.current = e.target.result
      setPreviewUrl(e.target.result)
      setResult(null); setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = e => {
    e.preventDefault(); setDragging(false)
    loadFile(e.dataTransfer.files?.[0])
  }

  const handleProcess = async () => {
    setProcessing(true); setError(''); setResult(null); setDownloaded(false)
    try {
      const payload = useUrl
        ? { imageUrl: inputUrl.trim() }
        : { imageData: imageDataRef.current }
      const data = await api('remove-background', payload)
      setResult(data.imageUrl)
      if (useUrl) setPreviewUrl(inputUrl.trim())
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result
    a.download = 'no-background.png'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setDownloaded(true); setTimeout(() => setDownloaded(false), 2500)
  }

  const canProcess = !processing && (useUrl ? inputUrl.trim().length > 0 : !!previewUrl)

  return (
    <div className="border border-purple-900/50 bg-[#0a0a0a]">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
        <h3 className="text-purple-400 text-xs font-mono uppercase tracking-widest">✂ Remove Background</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Source toggle */}
        <div className="flex gap-1">
          {[{ id: false, label: '📁 File' }, { id: true, label: '🔗 URL' }].map(opt => (
            <button key={String(opt.id)} onClick={() => { setUseUrl(opt.id); setError('') }}
              className={`px-3 py-1 text-xs border transition-colors ${
                useUrl === opt.id
                  ? 'border-purple-600 text-purple-300 bg-purple-900/20'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}>{opt.label}</button>
          ))}
        </div>

        {useUrl ? (
          <input
            value={inputUrl}
            onChange={e => { setInputUrl(e.target.value); setResult(null); setError('') }}
            placeholder="https://…"
            className="w-full bg-gray-800 border border-gray-700 text-white text-xs px-3 py-2 focus:outline-none focus:border-amber-600 font-mono"
          />
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
              dragging ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <p className="text-gray-600 text-xs">Drop image or click to upload</p>
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={e => loadFile(e.target.files?.[0])} />
          </div>
        )}

        {/* Preview row: original + result */}
        {(previewUrl || result) && (
          <div className="grid grid-cols-2 gap-3">
            {previewUrl && (
              <div className="space-y-1">
                <p className="text-gray-600 text-xs text-center">Original</p>
                <div className="aspect-square bg-gray-900 border border-gray-800 overflow-hidden flex items-center justify-center">
                  <img src={previewUrl} alt="Original" className="max-w-full max-h-full object-contain"
                    onError={e => { e.currentTarget.style.display = 'none' }} />
                </div>
              </div>
            )}
            {result && (
              <div className="space-y-1">
                <p className="text-gray-600 text-xs text-center">Result</p>
                {/* Checkerboard bg to show transparency */}
                <div className="aspect-square border border-gray-800 overflow-hidden flex items-center justify-center"
                  style={{ background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 16px 16px' }}
                >
                  <img src={result} alt="No background" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-xs">⚠ {error}</p>}

        <div className="flex items-center gap-2">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={`${btnPrimary} ${!canProcess ? 'opacity-40 cursor-not-allowed' : ''} flex items-center gap-2`}
          >
            {processing ? (
              <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />Processing…</>
            ) : '✂ Remove BG'}
          </button>
          {result && (
            <button onClick={handleDownload} className={btnGhost}>
              {downloaded ? '✓ Downloaded' : '⬇ Download PNG'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Collapsible ───────────────────────────────────────────────────────────────

function CopyBlock({ label, value, rows = 2 }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
        <button onClick={copy} className={`${btnGhost} text-[10px] py-0.5 px-2`}>
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={value}
        rows={rows}
        className="w-full bg-gray-900/50 border border-gray-800 text-gray-400 text-xs px-3 py-2 resize-none focus:outline-none font-mono leading-relaxed"
      />
    </div>
  )
}

function Collapsible({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1 w-full text-left"
      >
        <span className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▶</span>
        {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const knownCollections = [...new Set(allProducts.map(p => p.collection).filter(Boolean))]

export default function AdminProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Auth check
  const authed = sessionStorage.getItem('adminAuth') === '1'
  useEffect(() => {
    if (!authed) navigate('/admin', { replace: true })
  }, [authed])

  // Product state
  const [product, setProduct]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const isEditable = product?.adminManaged === true

  // Form state
  const [name, setName]             = useState('')
  const [price, setPrice]           = useState('')
  const [section, setSection]       = useState('objects')
  const [collection, setCollection] = useState('')
  const [movement, setMovement]     = useState('')
  const [description, setDescription] = useState('')
  const [altText, setAltText]       = useState('')
  const [tags, setTags]             = useState('')
  const [videoUrl, setVideoUrl]     = useState('')
  const [gelatoUid, setGelatoUid]   = useState('')
  const [printFileUrl,    setPrintFileUrl]    = useState('')
  const [neckLabelUrl,    setNeckLabelUrl]    = useState('')
  const [uploadingDesign, setUploadingDesign] = useState(false)
  const [designUploadErr, setDesignUploadErr] = useState('')
  // Staged print file: the source art fitted onto the 3661×4843 canvas, held for
  // preview so the operator confirms the placement BEFORE it is committed.
  const [designDraft,  setDesignDraft]  = useState(null)   // {previewUrl, blob, meta, filename}
  const [fittingDesign, setFittingDesign] = useState(false)
  const [autoFitDesign, setAutoFitDesign] = useState(true)
  const [featured, setFeatured]     = useState(false)  // 1 | 2 | false
  const [featuringNow, setFeaturingNow] = useState(false)
  const [relatedProducts, setRelatedProducts] = useState([])

  // Status
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const [saveErr, setSaveErr]       = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [saveLaunching, setSaveLaunching]   = useState(false)
  const [saveLaunchStatus, setSaveLaunchStatus] = useState('')

  // AI generation
  const [generating, setGenerating]             = useState(false)
  const [generatingEtsy,   setGeneratingEtsy]   = useState(false)
  const [generatingSocial, setGeneratingSocial] = useState(false)
  const [genErr, setGenErr]                     = useState('')
  const [aiProvider, setAiProvider]             = useState('openai')
  // AI social/SEO output
  const [instagramCaption, setInstagramCaption] = useState(product?.instagramCaption || '')
  const [pinterestCaption, setPinterestCaption] = useState(product?.pinterestCaption || '')
  const [pinterestPins,    setPinterestPins]    = useState(Array.isArray(product?.pinterestPins) ? product.pinterestPins : [])
  const [pinterestPublishedImages, setPinterestPublishedImages] = useState(Array.isArray(product?.pinterestPublishedImages) ? product.pinterestPublishedImages : [])
  const [generatingPins,   setGeneratingPins]   = useState(false)
  const [tiktokCaption,    setTiktokCaption]    = useState(product?.tiktokCaption    || '')
  const [pinterestBoardId,     setPinterestBoardId]     = useState(() => { try { return localStorage.getItem('jayl_pinterest_board_id') || '' } catch { return '' } })
  const [showPinterestPanel,   setShowPinterestPanel]   = useState(false)
  const [pinterestPublishing,  setPinterestPublishing]  = useState(false)
  const [pinterestMsg,         setPinterestMsg]         = useState('')
  const [pinterestPinUrl,      setPinterestPinUrl]      = useState('')
  const [pinterestImageChoice, setPinterestImageChoice] = useState('')  // stores URL directly
  const [pinterestBoards,      setPinterestBoards]      = useState([])
  const [loadingBoards,        setLoadingBoards]        = useState(false)
  const [pinterestEditCaption, setPinterestEditCaption] = useState('')
  const [hashtags, setHashtags]                 = useState('')
  const [primaryKeywords, setPrimaryKeywords]   = useState([])
  const [longTailKeywords, setLongTailKeywords] = useState([])
  // Etsy SEO
  const [etsyTitle,        setEtsyTitle]        = useState('')
  const [etsyTags,         setEtsyTags]         = useState([])
  const [etsyDescription,  setEtsyDescription]  = useState('')
  const [etsyImageAlts,    setEtsyImageAlts]    = useState([])
  const [seoTitle,         setSeoTitle]         = useState('')
  // Per-image alt texts
  const [imageAlts,        setImageAlts]        = useState({})
  const [generatingAlts,   setGeneratingAlts]   = useState(false)
  const [altsMsg,          setAltsMsg]          = useState('')

  // ── Lifted media state ────────────────────────────────────────────────────────
  const [desktopHero,    setDesktopHero]    = useState(null)
  const [mobileHero,     setMobileHero]     = useState(null)
  const [detailImage,    setDetailImage]    = useState(null)
  const [sequenza,       setSequenza]       = useState([])   // ordered array of URLs
  const [githubImages,   setGithubImages]   = useState([])   // [{ url, name, path }]
  const [loadingPool,    setLoadingPool]    = useState(false)
  const [poolRefreshKey, setPoolRefreshKey] = useState(0)
  const [savingMedia,    setSavingMedia]    = useState(false)
  const [mediaMsg,       setMediaMsg]       = useState('')

  // Gelato CDN URLs persisted so the pool doesn't empty after save
  const [gelatoCdnImages, setGelatoCdnImages] = useState([])
  // Gelato mockups the user removed for this product (persisted)
  const [excludedGelato, setExcludedGelato] = useState([])
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState('')

  // Load product
  useEffect(() => {
    const staticP = allProducts.find(p => p.id === id)

    const populate = p => {
      setProduct(p)
      setName(p.name || '')
      setPrice(p.price != null ? (p.price / 100).toString() : '')
      setSection(p.section || 'objects')
      setCollection(p.collection || '')
      setMovement(p.movement || '')
      setDescription(p.description || '')
      setAltText(p.altText || '')
      setTags(Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''))
      setVideoUrl(p.videoUrl || '')
      setGelatoUid(p.gelatoProductId || '')
      setPrintFileUrl(p.printFileUrl || '')
      setNeckLabelUrl(p.neckLabelUrl || '')
      setFeatured(p.featured === 1 ? 1 : p.featured === 2 ? 2 : false)
      setRelatedProducts(Array.isArray(p.relatedProducts) ? p.relatedProducts : [])
      // media
      setDesktopHero(p.image     || null)
      setMobileHero(p.heroImage   || null)
      setDetailImage(p.detailImage || null)
      setSequenza(Array.isArray(p.images) ? p.images : [])
      setGelatoCdnImages(Array.isArray(p.gelatoCdnImages) ? p.gelatoCdnImages : [])
      setExcludedGelato(Array.isArray(p.excludedGelato) ? p.excludedGelato : [])
      setPinterestPins(Array.isArray(p.pinterestPins) ? p.pinterestPins : [])
      setPinterestPublishedImages(Array.isArray(p.pinterestPublishedImages) ? p.pinterestPublishedImages : [])
      setImageAlts(p.imageAlts && typeof p.imageAlts === 'object' ? p.imageAlts : {})
      setEtsyTitle(p.etsyTitle || '')
      setEtsyTags(Array.isArray(p.etsyTags) ? p.etsyTags : [])
      setEtsyDescription(p.etsyDescription || '')
      setEtsyImageAlts(Array.isArray(p.etsyImageAlts) ? p.etsyImageAlts : [])
      setSeoTitle(p.seoTitle || '')
    }

    if (staticP?.adminManaged) {
      // Fetch latest from GitHub
      api('read-product', { productId: id })
        .then(data => { populate(data.product); setLoading(false) })
        .catch(() => { populate(staticP); setLoading(false) })
    } else if (staticP) {
      populate(staticP)
      setLoading(false)
    } else {
      // Might be a new product not yet in build
      api('read-product', { productId: id })
        .then(data => { populate(data.product); setLoading(false) })
        .catch(() => { setNotFound(true); setLoading(false) })
    }
  }, [id])

  // ── Load GitHub images (re-runs when pool needs refresh) ────────────────────
  useEffect(() => {
    if (!id) return
    setLoadingPool(true)
    api('list-images', { productId: id })
      .then(data => setGithubImages(data.images || []))
      .catch(() => setGithubImages([]))
      .finally(() => setLoadingPool(false))
  }, [id, poolRefreshKey])

  // ── Computed image categories ─────────────────────────────────────────────
  const gelatoImages = useMemo(() => {
    const urls = new Set()
    const add  = u => u && !urls.has(u) && urls.add(u)
    // Prefer stored CDN URLs (survive save/reload cycle)
    gelatoCdnImages.forEach(u => add(u))
    // Fallback: scan product fields for non-github URLs (legacy products without gelatoCdnImages)
    if (gelatoCdnImages.length === 0) {
      ;(product?.images || []).forEach(u => { if (u && !u.includes('raw.githubusercontent.com')) add(u) })
      if (product?.image     && !product.image.includes('raw.githubusercontent.com'))     add(product.image)
      if (product?.heroImage && !product.heroImage.includes('raw.githubusercontent.com')) add(product.heroImage)
    }
    const excl = new Set(excludedGelato)
    return [...urls].filter(u => !excl.has(u)).map(url => ({ url, name: url.split('/').pop().split('?')[0] || 'image' }))
  }, [product, gelatoCdnImages, excludedGelato])

  const uploadedImages  = useMemo(() => githubImages.filter(img => !img.path?.includes('/generated/')), [githubImages])
  const generatedImages = useMemo(() => githubImages.filter(img =>  img.path?.includes('/generated/')), [githubImages])
  const allPoolImages   = useMemo(() => [...gelatoImages, ...uploadedImages, ...generatedImages], [gelatoImages, uploadedImages, generatedImages])

  // ── Media handlers ────────────────────────────────────────────────────────
  const toggleSequenza = useCallback(url => {
    setSequenza(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])
  }, [])

  const handleSaveMedia = useCallback(async () => {
    if (!id) return
    setSavingMedia(true); setMediaMsg('')
    try {
      await api('update-product-images', {
        productId:   id,
        images:      sequenza,
        heroImage:   mobileHero   || null,
        image:       desktopHero  || sequenza[0] || null,
        detailImage: detailImage  || null,
      })
      setProduct(prev => prev ? {
        ...prev,
        images:      sequenza,
        image:       desktopHero  || sequenza[0] || prev.image,
        heroImage:   mobileHero   || prev.heroImage,
        detailImage: detailImage  || null,
      } : prev)
      setMediaMsg('✓ Salvato')
      setTimeout(() => setMediaMsg(''), 3000)
    } catch (e) {
      setMediaMsg('⚠ ' + e.message)
    } finally {
      setSavingMedia(false)
    }
  }, [id, sequenza, desktopHero, mobileHero, detailImage])

  const videoInfo = parseVideoUrl(videoUrl)

  // Genera SEO sito: title, description, alt, tags, keywords, hashtags, IG/Pinterest captions
  const generateWithAI = async () => {
    if (!name.trim()) return setGenErr('Enter a product name first')
    setGenerating(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim(), section, collection, movement, provider: aiProvider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      if (data.seoTitle)    setSeoTitle(data.seoTitle)
      if (data.description) setDescription(data.description)
      if (data.altText)     setAltText(data.altText)
      if (data.tags?.length)              setTags(data.tags.join(', '))
      if (data.instagramCaption)          setInstagramCaption(data.instagramCaption)
      if (data.pinterestCaption)          setPinterestCaption(data.pinterestCaption)
      if (data.hashtags)                  setHashtags(data.hashtags)
      if (data.primaryKeywords?.length)   setPrimaryKeywords(data.primaryKeywords)
      if (data.longTailKeywords?.length)  setLongTailKeywords(data.longTailKeywords)
      if (name.trim() && price) await saveWith({
        ...(data.seoTitle ? { seoTitle: data.seoTitle } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.altText ? { altText: data.altText } : {}),
        ...(data.tags?.length ? { tags: data.tags } : {}),
        ...(data.instagramCaption ? { instagramCaption: data.instagramCaption } : {}),
        ...(data.pinterestCaption ? { pinterestCaption: data.pinterestCaption } : {}),
        ...(data.hashtags ? { hashtags: data.hashtags } : {}),
        ...(data.primaryKeywords?.length ? { primaryKeywords: data.primaryKeywords } : {}),
        ...(data.longTailKeywords?.length ? { longTailKeywords: data.longTailKeywords } : {}),
      })
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGenerating(false)
    }
  }

  // Genera SEO Etsy: etsyTitle, etsyTags, etsyDescription (separate call — heavier output)
  const generateEtsyAI = async () => {
    if (!name.trim()) return setGenErr('Enter a product name first')
    setGeneratingEtsy(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-etsy-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim(), section, collection, movement, provider: aiProvider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Etsy generation failed')
      if (data.etsyTitle)           setEtsyTitle(data.etsyTitle)
      if (data.etsyTags?.length)    setEtsyTags(data.etsyTags)
      if (data.etsyDescription)     setEtsyDescription(data.etsyDescription)
      if (data.etsyImageAlts?.length) setEtsyImageAlts(data.etsyImageAlts)
      if (name.trim() && price) await saveWith({
        ...(data.etsyTitle ? { etsyTitle: data.etsyTitle } : {}),
        ...(data.etsyTags?.length ? { etsyTags: data.etsyTags } : {}),
        ...(data.etsyDescription ? { etsyDescription: data.etsyDescription } : {}),
        ...(data.etsyImageAlts?.length ? { etsyImageAlts: data.etsyImageAlts } : {}),
      })
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGeneratingEtsy(false)
    }
  }

  // Genera SEO Social: instagramCaption, pinterestCaption, tiktokCaption, hashtags
  const generateSocialAI = async () => {
    if (!name.trim()) return setGenErr('Enter a product name first')
    setGeneratingSocial(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-social-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim(), section, collection, movement, provider: aiProvider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Social generation failed')
      if (data.instagramCaption) setInstagramCaption(data.instagramCaption)
      if (data.pinterestCaption) setPinterestCaption(data.pinterestCaption)
      if (data.tiktokCaption)    setTiktokCaption(data.tiktokCaption)
      if (data.hashtags)         setHashtags(data.hashtags)
      if (name.trim() && price) await saveWith({
        ...(data.instagramCaption ? { instagramCaption: data.instagramCaption } : {}),
        ...(data.pinterestCaption ? { pinterestCaption: data.pinterestCaption } : {}),
        ...(data.tiktokCaption ? { tiktokCaption: data.tiktokCaption } : {}),
        ...(data.hashtags ? { hashtags: data.hashtags } : {}),
      })
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGeneratingSocial(false)
    }
  }

  // Pinterest 5-pack: each press generates 5 pins (title + text + tags) and APPENDS them (autosaved)
  const generatePinterestPins = async () => {
    if (!name.trim()) return setGenErr('Enter a product name first')
    setGeneratingPins(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-pinterest-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim(), section, collection, movement, provider: aiProvider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pinterest generation failed')
      const next = [...pinterestPins, ...((data.pins) || [])]
      setPinterestPins(next)
      if (name.trim() && price) await saveWith({ pinterestPins: next })
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGeneratingPins(false)
    }
  }

  const generateAlts = async () => {
    // Build image list: each known image URL with its role
    const imageEntries = []
    const seen = new Set()
    const add = (url, role) => { if (url && !seen.has(url)) { seen.add(url); imageEntries.push({ url, role }) } }
    add(desktopHero,  'hero-desktop-16:9')
    add(mobileHero,   'hero-mobile-9:16')
    add(detailImage,  'detail-reveal')
    sequenza.forEach((url, i) => add(url, `gallery-${i + 1}`))
    // Add any pool images not yet assigned
    allPoolImages.forEach(img => add(img.url, 'pool'))
    if (!imageEntries.length) return setAltsMsg('⚠ Nessuna immagine trovata')
    setGeneratingAlts(true); setAltsMsg('')
    try {
      // Batch the images so each request stays well under the serverless time
      // limit — one giant call for the whole pool was the cause of the timeout.
      const BATCH = 6
      const merged = { ...imageAlts }
      const before = Object.keys(merged).length
      for (let i = 0; i < imageEntries.length; i += BATCH) {
        const chunk = imageEntries.slice(i, i + BATCH)
        setAltsMsg(`Generando… ${Math.min(i + chunk.length, imageEntries.length)}/${imageEntries.length}`)
        const res = await fetch('/api/generate-alts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productTitle: name.trim() || 'JAYL product', movement, collection, images: chunk, provider: aiProvider }),
          signal: AbortSignal.timeout(90_000),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Alt text generation failed')
        Object.assign(merged, data.alts || {})
        setImageAlts({ ...merged })
      }
      const added = Object.keys(merged).length - before
      setAltsMsg(`✓ ${added} alt text generati (${Object.keys(merged).length} totali)`)
      setTimeout(() => setAltsMsg(''), 4000)
      if (name.trim() && price) await saveWith({ imageAlts: merged })
    } catch (e) {
      const m = e?.name === 'TimeoutError'
        ? 'Timeout su un blocco — riprova (alcune immagini sono lente/grandi)'
        : (e?.message || 'Errore')
      setAltsMsg('⚠ ' + m)
    } finally {
      setGeneratingAlts(false)
    }
  }

  // Called by the redirect "Condividi sui social" Pinterest button after opening
  // the pin-builder — marks the used pin + image as published and persists it.
  const markPinterestPublished = ({ pinIndex, imageUrl }) => {
    let nextPins = pinterestPins
    if (pinIndex != null && pinterestPins[pinIndex] && !pinterestPins[pinIndex].published) {
      nextPins = pinterestPins.map((p, j) => (j === pinIndex ? { ...p, published: true } : p))
      setPinterestPins(nextPins)
    }
    let nextImgs = pinterestPublishedImages
    if (imageUrl && !pinterestPublishedImages.includes(imageUrl)) {
      nextImgs = [...pinterestPublishedImages, imageUrl]
      setPinterestPublishedImages(nextImgs)
    }
    if ((nextPins !== pinterestPins || nextImgs !== pinterestPublishedImages) && name.trim() && price) {
      saveWith({ pinterestPins: nextPins, pinterestPublishedImages: nextImgs })
    }
  }

  const publishToPinterest = async () => {
    if (!pinterestBoardId.trim()) return setPinterestMsg('⚠ Inserisci un Board ID prima')
    const imageUrl = pinterestImageChoice || desktopHero || sequenza[0]
    if (!imageUrl) return setPinterestMsg('⚠ Nessuna immagine trovata')
    setPinterestPublishing(true); setPinterestMsg('')
    try {
      localStorage.setItem('jayl_pinterest_board_id', pinterestBoardId.trim())
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform:    'pinterest',
          password:    getAdminPassword(),
          boardId:     pinterestBoardId.trim(),
          title:       name.trim(),
          description: pinterestEditCaption || pinterestCaption || description.slice(0, 500),
          imageUrl,
          link:        `https://jayl.store/product/${product?.id || ''}`,
          altText:     altText || name,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || data.message || 'Errore Pinterest API')
      setPinterestPinUrl(data.pinUrl || '')
      setPinterestMsg('✓ Pin pubblicato!')
    } catch (e) {
      setPinterestMsg('⚠ ' + e.message)
    } finally {
      setPinterestPublishing(false)
    }
  }

  const fetchPinterestBoards = async () => {
    if (pinterestBoards.length > 0) return // already loaded
    setLoadingBoards(true)
    try {
      const res = await fetch('/api/pinterest/boards')
      const data = await res.json()
      if (data.boards?.length) setPinterestBoards(data.boards)
    } catch {}
    finally { setLoadingBoards(false) }
  }

  const handleSaveAndLaunch = async () => {
    setSaveLaunching(true)
    setSaveLaunchStatus('💾 Salvataggio...')
    try {
      await handleSave()
      setSaveLaunchStatus('✨ Generando con AI...')
      await generateWithAI()
      setSaveLaunchStatus('📌 Pubblicando su Pinterest...')
      await publishToPinterest()
      setSaveLaunchStatus('✅ Lanciato!')
    } catch (e) {
      setSaveLaunchStatus('⚠ ' + (e.message || 'Errore'))
    } finally {
      setSaveLaunching(false)
      setTimeout(() => setSaveLaunchStatus(''), 4000)
    }
  }

  const saveWith = async (overrides = {}) => {
    if (!name.trim()) return setSaveErr('Name is required')
    if (!price)       return setSaveErr('Price is required')
    setSaving(true); setSaveErr(''); setSaveMsg('')
    try {
      const priceCents = Math.round(parseFloat(price) * 100)
      const updated = {
        ...product,
        name: name.trim(),
        price: priceCents,
        section,
        collection,
        subtitle: collection,
        movement,
        description: description.trim(),
        altText: altText.trim(),
        tags: tags.trim()
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : product.tags || [],
        featured,
        relatedProducts: relatedProducts.filter(Boolean),
        gelatoProductId: gelatoUid.trim() || null,
        ...(printFileUrl.trim() ? { printFileUrl: printFileUrl.trim() } : {}),
        ...(neckLabelUrl.trim() ? { neckLabelUrl: neckLabelUrl.trim() } : {}),
        adminManaged: true,
        // ── media (unified save — no need to press a separate button) ──
        images:      sequenza,
        image:       desktopHero  || sequenza[0] || product.image  || null,
        heroImage:   mobileHero   || product.heroImage || null,
        detailImage: detailImage  || null,
        imageAlts:   Object.keys(imageAlts).length > 0 ? imageAlts : undefined,
        ...(videoUrl.trim()        ? { videoUrl:        videoUrl.trim() }        : { videoUrl: undefined }),
        ...(etsyTitle.trim()           ? { etsyTitle:         etsyTitle.trim() }           : {}),
        ...(etsyTags.length > 0        ? { etsyTags:          etsyTags }                   : {}),
        ...(etsyDescription.trim()     ? { etsyDescription:   etsyDescription.trim() }     : {}),
        ...(etsyImageAlts.length > 0   ? { etsyImageAlts }                                 : {}),
        ...(seoTitle.trim()          ? { seoTitle:          seoTitle.trim() }          : {}),
        ...(instagramCaption.trim()  ? { instagramCaption:  instagramCaption.trim() }  : {}),
        ...(pinterestCaption.trim()  ? { pinterestCaption:  pinterestCaption.trim() }  : {}),
        ...(tiktokCaption.trim()     ? { tiktokCaption:     tiktokCaption.trim() }     : {}),
        ...(hashtags.trim()          ? { hashtags:          hashtags.trim() }          : {}),
        ...(gelatoCdnImages.length > 0 ? { gelatoCdnImages } : {}),
      }
      updated.excludedGelato = excludedGelato.length ? excludedGelato : undefined
      updated.pinterestPins  = pinterestPins.length  ? pinterestPins  : undefined
      updated.pinterestPublishedImages = pinterestPublishedImages.length ? pinterestPublishedImages : undefined
      // Fresh AI values (passed by the generators) take precedence over stale React state
      Object.assign(updated, overrides)
      // Clean undefined/null keys that weren't set before
      Object.keys(updated).forEach(k => updated[k] === undefined && delete updated[k])

      await api('save-product', { product: updated })
      setProduct(updated)
      setSaveMsg('✓ Salvato — Vercel rebuilderà automaticamente.')
      setTimeout(() => setSaveMsg(''), 4000)
    } catch (e) {
      setSaveErr(e.message)
    } finally {
      setSaving(false)
    }
  }
  // Button handler (onClick passes a click event — ignore it). Generators call saveWith(overrides).
  const handleSave = () => saveWith({})

  // Remove a Gelato/external mockup from this product (persisted, so it stays removed after reload)
  const excludeGelato = (url) => {
    const next = excludedGelato.includes(url) ? excludedGelato : [...excludedGelato, url]
    setExcludedGelato(next)
    if (name.trim() && price) saveWith({ excludedGelato: next })
  }

  // withSave=true → auto-saves gelatoCdnImages to product after sync
  // (passes cdnUrls directly to avoid stale React closure on gelatoCdnImages state)
  const syncGelato = async (withSave = false) => {
    if (!gelatoUid.trim()) return
    setSyncing(true); setSyncMsg('')
    try {
      const res = await fetch(`/api/get-product-variants?productId=${encodeURIComponent(gelatoUid.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fetch failed')
      const fetchedImages = data.images || []
      if (fetchedImages.length === 0) { setSyncMsg('⚠ Nessuna immagine trovata su Gelato'); return }

      // Store CDN URLs before import (these survive after github paths replace product.images)
      const cdnUrls = fetchedImages.map(img => img.src)

      setSyncMsg(`Importando ${fetchedImages.length} mockup…`)
      const fetchedVariants = data.variants || []
      const vColorMap = Object.fromEntries(
        fetchedVariants.filter(v => v.uid && v.color).map(v => [v.uid, v.color])
      )
      const imagesWithColor = fetchedImages.map(img => ({
        src:   img.src,
        color: (img.variantIds || []).map(vid => vColorMap[vid]).find(Boolean) ?? null,
      }))

      const importData = await api('import-gelato-images', {
        productId:    id,
        productTitle: name.trim(),
        images:       imagesWithColor,
      })
      const paths = importData.paths || []
      setGelatoCdnImages(cdnUrls)
      setPoolRefreshKey(k => k + 1)
      if (sequenza.length === 0) setSequenza(paths)

      if (withSave) {
        // Patch only gelatoCdnImages — pass cdnUrls directly to avoid stale closure
        setSyncMsg('Salvando…')
        const updated = { ...product, gelatoCdnImages: cdnUrls }
        await api('save-product', { product: updated })
        setProduct(updated)
        setSyncMsg(`✓ ${paths.length} mockup sincronizzati e salvati automaticamente`)
      } else {
        setSyncMsg(`✓ ${paths.length} mockup importati (ricorda di salvare)`)
      }
    } catch (e) {
      setSyncMsg(`⚠ ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  // Which side this product prints on. Derived from the Gelato productUid exactly
  // like api/_lib/placement.js does, so the preview matches what Gelato receives.
  const placement = useMemo(() => detectPlacement(product), [product])

  /**
   * Step 1 — pick a file. When auto-fit is on we do NOT upload yet: the artwork is
   * composed onto the print canvas and staged for review. Uploading straight away
   * was how wrongly-placed designs used to reach the repo unnoticed.
   */
  const handlePickDesign = async (file) => {
    if (!file) return
    setDesignUploadErr('')
    const isRaster = /^image\/(png|jpeg|webp)$/.test(file.type)
    if (!autoFitDesign || !isRaster) {
      // PDFs and SVGs cannot be measured on a canvas — upload them untouched.
      return handleUploadDesign(file)
    }
    setFittingDesign(true)
    try {
      const fitted = await fitDesignToCanvas(file, placement.type)
      setDesignDraft({ ...fitted, filename: sanitizeFilename(file.name.replace(/\.[^.]+$/, '') + '.png') })
    } catch (e) {
      setDesignUploadErr(e.message || 'Impossibile adattare il file')
    } finally {
      setFittingDesign(false)
    }
  }

  /** Step 2 — confirm the staged canvas and commit it. */
  const handleConfirmDesign = async () => {
    if (!designDraft) return
    const file = new File([designDraft.blob], designDraft.filename, { type: 'image/png' })
    // Keep the staged canvas on failure so the operator can retry without
    // re-picking and re-fitting the source file.
    if (await handleUploadDesign(file)) setDesignDraft(null)
  }

  const handleUploadDesign = async (file) => {
    if (!file) return
    // Without a deadline this spinner runs forever: a 6400×4800 source PNG is tens
    // of MB, gets base64-inflated by a third, and is held whole in the serverless
    // function before the GitHub PUT. When that stalls there is nothing to catch —
    // the media uploader has had this timeout for a while, this one never did.
    const ctrl  = new AbortController()
    const timer = setTimeout(
      () => ctrl.abort(new Error('Timeout — upload troppo lento (>120s). Il file è probabilmente troppo grande: lascia attivo l’adattamento automatico, che lo rigenera alla dimensione di stampa.')),
      120_000,
    )
    setUploadingDesign(true); setDesignUploadErr('')
    const sanitized = sanitizeFilename(file.name)
    try {
      // Try Vercel Blob client upload for large files
      const blob = await blobUpload(sanitized, file, {
        access: 'public',
        handleUploadUrl: '/api/admin',
        clientPayload: JSON.stringify({ password: getAdminPassword(), productId: id }),
        abortSignal: ctrl.signal,
      })
      const result = await api('upload-design', { productId: id, filename: sanitized, blobUrl: blob.url }, ctrl.signal)
      setPrintFileUrl(result.url)
      return true
    } catch (e1) {
      if (ctrl.signal.aborted) {
        setDesignUploadErr(ctrl.signal.reason?.message || 'Timeout upload')
        return false
      }
      // Fallback: base64 for smaller files
      try {
        const dataUrl = await fileToBase64(file)
        const result = await api('upload-design', { productId: id, filename: sanitized, dataUrl }, ctrl.signal)
        setPrintFileUrl(result.url)
        return true
      } catch (e2) {
        setDesignUploadErr(
          ctrl.signal.aborted
            ? (ctrl.signal.reason?.message || 'Timeout upload')
            : (e2.message || e1.message || 'Upload failed'),
        )
        return false
      }
    } finally {
      clearTimeout(timer)
      setUploadingDesign(false)
    }
  }

  const handleSetSlot = async (slot) => {
    // slot = 1 | 2 — click on active slot removes it (false)
    const next = featured === slot ? false : slot
    setFeaturingNow(true)
    try {
      await api('set-featured', { productId: id, featured: next })
      setFeatured(next)
      setSaveMsg(
        next === 1 ? '① Impostato come Prima Pagina 1 — deploy in corso.'
        : next === 2 ? '② Impostato come Prima Pagina 2 — deploy in corso.'
        : '○ Rimosso dalla prima pagina.'
      )
      setTimeout(() => setSaveMsg(''), 4000)
    } catch (e) {
      setSaveErr(e.message)
    } finally {
      setFeaturingNow(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api('delete-product', { productId: id })
      navigate('/admin', { replace: true })
    } catch (e) {
      setSaveErr(e.message)
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!authed) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading product…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Product <span className="font-mono text-white">{id}</span> not found.</p>
        <Link to="/admin" className={btnGhost}>← Back to Products</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Sticky header ── */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-13 flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/admin"
              className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              ← Products
            </Link>
            <span className="text-gray-700 flex-shrink-0">·</span>
            <span className="font-mono text-xs text-gray-400 truncate">{id}</span>
            {isEditable
              ? <span className="bg-[#1a1a0f] border border-indigo-800 text-indigo-300 text-xs px-2 py-0.5 flex-shrink-0">admin-managed</span>
              : <span className="bg-gray-800 text-gray-500 text-xs px-2 py-0.5 flex-shrink-0">hardcoded</span>
            }
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View on site */}
            <a
              href={`/product/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnGhost}
            >
              🌐 View on site
            </a>

            {isEditable && (
              <>
                {/* ── Hero previews + Prima Pagina slot buttons ──
                    Both thumbnails are previews of THIS product's heroes.
                    The two buttons assign the product to homepage slot 1 or 2 (independent of desktop/mobile). */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {/* Hero previews row — desktop 16:9 + mobile 9:16 */}
                  <div className="flex items-end gap-1">
                    {/* Desktop 16:9 */}
                    <div className="relative w-[68px] h-[38px] bg-[#111] border border-[#252525] overflow-hidden">
                      {desktopHero ? (
                        /\.(mp4|mov|webm)$/i.test(desktopHero)
                          ? <div className="w-full h-full flex items-center justify-center text-base">🎬</div>
                          : <img src={desktopHero} alt="desktop" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-[#444]">no img</div>
                      )}
                      <div className="absolute top-0 left-0 bg-black/60 text-[#666] text-[7px] px-0.5 py-px leading-none">🖥</div>
                    </div>
                    {/* Mobile 9:16 */}
                    <div className="relative w-[22px] h-[38px] bg-[#111] border border-[#252525] overflow-hidden">
                      {mobileHero ? (
                        /\.(mp4|mov|webm)$/i.test(mobileHero)
                          ? <div className="w-full h-full flex items-center justify-center text-[10px]">🎬</div>
                          : <img src={mobileHero} alt="mobile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-[#444]">📱</div>
                      )}
                      <div className="absolute top-0 left-0 bg-black/60 text-[#666] text-[6px] px-0.5 py-px leading-none">📱</div>
                    </div>
                  </div>

                  {/* Slot buttons — assign this product (desktop+mobile heroes) to P.P. 1 or 2 */}
                  <div className="flex gap-1 w-full">
                    <button
                      onClick={() => handleSetSlot(1)}
                      disabled={featuringNow}
                      title="Imposta come Prima Pagina 1 (prima sezione homepage)"
                      className={`flex-1 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer disabled:opacity-40 text-center ${
                        featured === 1
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'border-[#252525] text-[#555] hover:border-amber-500/40 hover:text-amber-500'
                      }`}
                    >
                      {featuringNow && featured !== 2 ? '…' : featured === 1 ? '① on' : '① P.P.1'}
                    </button>
                    <button
                      onClick={() => handleSetSlot(2)}
                      disabled={featuringNow}
                      title="Imposta come Prima Pagina 2 (seconda sezione homepage)"
                      className={`flex-1 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer disabled:opacity-40 text-center ${
                        featured === 2
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'border-[#252525] text-[#555] hover:border-amber-500/40 hover:text-amber-500'
                      }`}
                    >
                      {featuringNow && featured !== 1 ? '…' : featured === 2 ? '② on' : '② P.P.2'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={btnDanger}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-5 py-2 text-sm font-semibold transition-colors cursor-pointer"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {/* Save & Launch */}
                <button
                  onClick={handleSaveAndLaunch}
                  disabled={saveLaunching || !name.trim()}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-5 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  {saveLaunching ? saveLaunchStatus : '🚀 Salva & Lancia'}
                </button>
                {saveLaunchStatus && !saveLaunching && (
                  <span className="text-xs text-amber-400">{saveLaunchStatus}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Status bar */}
        {(saveMsg || saveErr) && (
          <div className={`px-6 py-2 text-xs ${saveMsg ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {saveMsg || saveErr}
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isEditable && (
          <div className="mb-6 bg-amber-900/20 border border-amber-800 px-4 py-3 text-amber-300 text-sm">
            This product is hardcoded in <span className="font-mono">src/data/products.js</span> and cannot be edited here. Fields are shown read-only.
          </div>
        )}

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* ── Left: image gallery ── */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <ImagePool
              gelatoImages={gelatoImages}
              uploadedImages={uploadedImages}
              generatedImages={generatedImages}
              desktopHero={desktopHero}
              mobileHero={mobileHero}
              sequenza={sequenza}
              detailImage={detailImage}
              onSetDesktopHero={setDesktopHero}
              onSetMobileHero={setMobileHero}
              onToggleSequenza={toggleSequenza}
              onSetDetailImage={setDetailImage}
              productId={id}
              onUploaded={() => setPoolRefreshKey(k => k + 1)}
              loading={loadingPool}
              onExcludeGelato={excludeGelato}
            />

            {/* Image status summary */}
            <div className="bg-[#0a0a0a] border border-gray-800/60 px-3 py-2 space-y-1 text-[11px] text-gray-600">
              {desktopHero && <div className="flex items-center gap-1.5"><span className="text-blue-400">🖥</span><span className="text-gray-500 truncate">Hero desktop assegnato</span></div>}
              {mobileHero  && <div className="flex items-center gap-1.5"><span className="text-purple-400">📱</span><span className="text-gray-500 truncate">Hero mobile assegnato</span></div>}
              {detailImage && <div className="flex items-center gap-1.5"><span className="text-amber-400">🔍</span><span className="text-gray-500 truncate">Dettaglio assegnato</span></div>}
              {sequenza.length > 0 && <div className="flex items-center gap-1.5"><span>🖼</span><span className="text-gray-500">{sequenza.length} immagini in sequenza</span></div>}
              {Object.keys(imageAlts).length > 0 && <div className="flex items-center gap-1.5"><span className="text-amber-400">✨</span><span className="text-gray-500">{Object.keys(imageAlts).length} alt text pronti</span></div>}
              {!desktopHero && !mobileHero && !sequenza.length && <span className="text-gray-700 italic">Nessuna immagine assegnata</span>}
            </div>
          </div>

          {/* ── Right: edit form ── */}
          <div className="space-y-8">

            {/* ── Hero & Sequenza ── */}
            {isEditable && (
              <MediaPanel
                desktopHero={desktopHero}
                mobileHero={mobileHero}
                detailImage={detailImage}
                sequenza={sequenza}
                allImages={allPoolImages}
                onSetDesktopHero={setDesktopHero}
                onSetMobileHero={setMobileHero}
                onSetDetailImage={setDetailImage}
                onReorderSequenza={setSequenza}
                onSave={handleSaveMedia}
                saving={savingMedia}
                msg={mediaMsg}
              />
            )}

            {/* ── 1. Prodotto ── */}
            <Section title="Prodotto" icon="📝" color="gray">
              <Field label="Nome prodotto" hint={`id: ${id}`}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isEditable}
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>
              <Field label="Descrizione" hint="~150 words · shown in the About accordion on the product page">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!isEditable}
                  rows={6}
                  className={`${inputCls} resize-y${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>
              <Field
                label="Tag interni (separati da virgola)"
                hint={`${tags.split(',').filter(t => t.trim()).length}/13 tags · each max 20 chars`}
              >
                <textarea
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  placeholder="snorlax shirt, pokemon gift, anime tee, …"
                  className={`${inputCls} resize-none${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>
            </Section>

            {/* ── 2. Prezzi & Categoria ── */}
            <Section title="Prezzi & Categoria" icon="💶" color="emerald">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prezzo (€)">
                  <input
                    type="number" min="0" step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>

                <Field label="Sezione">
                  <select
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  >
                    <option value="objects">objects</option>
                    <option value="apparel">apparel</option>
                    <option value="wall-art">wall-art</option>
                    <option value="accessories">accessories</option>
                    <option value="art">art</option>
                  </select>
                </Field>

                <Field label="Collezione">
                  <input
                    value={collection}
                    onChange={e => setCollection(e.target.value)}
                    disabled={!isEditable}
                    list="known-collections"
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                  <datalist id="known-collections">
                    {knownCollections.map(c => <option key={c} value={c} />)}
                  </datalist>
                </Field>

                <Field label="Movement / Style">
                  <input
                    value={movement}
                    onChange={e => setMovement(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>
              </div>

              {isEditable && featured && (
                <p className="text-amber-400/80 text-xs mt-1">
                  {featured === 1 ? '① In Prima Pagina — Slot 1 (prima sezione)' : '② In Prima Pagina — Slot 2 (seconda sezione)'}
                  {' '}<button onClick={() => handleSetSlot(featured)} className="underline opacity-60 hover:opacity-100">rimuovi</button>
                </p>
              )}

              {isEditable && (
                <Field label="Complete the Look — Prodotti correlati" hint="Up to 4 products shown as upsell at the bottom of this product page">
                  <div className="space-y-1.5">
                    {[0, 1, 2, 3].map(i => (
                      <select
                        key={i}
                        value={relatedProducts[i] || ''}
                        onChange={e => {
                          const next = [...relatedProducts]
                          if (e.target.value) {
                            next[i] = e.target.value
                          } else {
                            next.splice(i, 1)
                          }
                          setRelatedProducts(next.filter(Boolean).slice(0, 4))
                        }}
                        className={inputCls + ' text-xs'}
                      >
                        <option value="">— None —</option>
                        {allProducts
                          .filter(p => p.id !== id)
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                    ))}
                  </div>
                </Field>
              )}
            </Section>

            {/* ── 3. Genera con AI ── */}
            <Section title="Genera con AI" icon="🤖" color="amber">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-gray-500 text-[11px]">Provider AI per la generazione testi</p>
                  <select
                    value={aiProvider}
                    onChange={e => setAiProvider(e.target.value)}
                    disabled={generating || generatingEtsy}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:outline-none focus:border-amber-600 transition-colors cursor-pointer disabled:opacity-40 flex-shrink-0"
                    title="AI text provider"
                  >
                    <option value="openai">GPT-4o mini</option>
                    <option value="longcat-flash">Longcat Flash</option>
                    <option value="longcat-thinking">Longcat Thinking</option>
                  </select>
                </div>
                {/* SEO Sito */}
                <button
                  onClick={generateWithAI}
                  disabled={generating || generatingEtsy || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2.5 text-xs font-semibold transition-colors"
                >
                  {generating ? (
                    <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Generando SEO Sito…</>
                  ) : (
                    <>⚡ Genera SEO Sito</>
                  )}
                </button>
                {/* SEO Etsy */}
                <button
                  onClick={generateEtsyAI}
                  disabled={generatingEtsy || generating || generatingSocial || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-orange-800 hover:bg-orange-700 disabled:opacity-40 text-orange-100 px-4 py-2.5 text-xs font-semibold transition-colors"
                >
                  {generatingEtsy ? (
                    <><span className="animate-spin inline-block w-3 h-3 border-2 border-orange-200 border-t-transparent rounded-full" /> Generando SEO Etsy…</>
                  ) : (
                    <>🏪 Genera SEO Etsy</>
                  )}
                </button>
                {/* SEO Social */}
                <button
                  onClick={generateSocialAI}
                  disabled={generatingSocial || generating || generatingEtsy || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-pink-900 hover:bg-pink-800 disabled:opacity-40 text-pink-100 px-4 py-2.5 text-xs font-semibold transition-colors"
                >
                  {generatingSocial ? (
                    <><span className="animate-spin inline-block w-3 h-3 border-2 border-pink-200 border-t-transparent rounded-full" /> Generando Social…</>
                  ) : (
                    <>📱 Genera SEO Social</>
                  )}
                </button>
                <button
                  onClick={generateAlts}
                  disabled={generatingAlts}
                  className="w-full flex items-center justify-center gap-2 bg-amber-900 hover:bg-amber-800 disabled:opacity-40 text-amber-200 px-3 py-2 text-xs font-medium transition-colors"
                >
                  {generatingAlts
                    ? <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> Generando alt text…</>
                    : `🖼 Genera Alt Text immagini${allPoolImages.length ? ` (${[desktopHero, mobileHero, detailImage, ...sequenza].filter(Boolean).length + allPoolImages.filter(img => ![desktopHero, mobileHero, detailImage, ...sequenza].includes(img.url)).length} immagini)` : ''}`
                  }
                </button>
                {genErr && <p className="text-red-400 text-xs">{genErr}</p>}
                {altsMsg && (
                  <p className={`text-xs ${altsMsg.startsWith('✓') ? 'text-amber-300' : 'text-red-400'}`}>{altsMsg}</p>
                )}
                {!genErr && !generating && altText && description && (
                  <p className="text-amber-400 text-xs">✓ AI content applicato</p>
                )}
                {Object.keys(imageAlts).length > 0 && (
                  <Collapsible label={`${Object.keys(imageAlts).length} alt text generati — espandi per vedere`}>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {Object.entries(imageAlts).map(([url, alt]) => (
                        <div key={url} className="flex gap-2 items-start">
                          <img src={url} alt="" className="w-8 h-8 object-cover flex-shrink-0 border border-gray-800 opacity-60"
                            onError={e => { e.currentTarget.style.display = 'none' }} />
                          <input
                            value={alt}
                            onChange={e => setImageAlts(prev => ({ ...prev, [url]: e.target.value }))}
                            className="flex-1 bg-transparent border border-gray-800 text-gray-400 text-[11px] px-2 py-1 focus:outline-none focus:border-violet-700 font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </Collapsible>
                )}
              </div>
            </Section>

            {/* ── 4. SEO Google ── */}
            <Section title="SEO Google" icon="🔵" color="blue">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">
                    SEO Title
                    <span className={`ml-2 font-mono ${seoTitle.length > 65 ? 'text-red-400' : seoTitle.length >= 50 ? 'text-green-500' : 'text-yellow-400'}`}>
                      {seoTitle.length}/65
                    </span>
                  </p>
                  <span className="text-gray-700 text-[10px]">usePageMeta aggiunge "— JAYL" automaticamente</span>
                </div>
                <input
                  value={seoTitle}
                  onChange={e => setSeoTitle(e.target.value)}
                  placeholder="Mewtwo Pokemon T-Shirt | Retro 90s Anime Fan Gift"
                  className="w-full bg-gray-900/50 border border-gray-800 text-gray-300 text-xs px-3 py-2 focus:outline-none focus:border-blue-700 font-mono"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">
                    Alt Text immagine hero
                    <span className={`ml-2 font-mono ${altText.length > 125 ? 'text-red-400' : altText.length > 0 ? 'text-green-500' : 'text-gray-600'}`}>
                      {altText.length}/125
                    </span>
                  </p>
                </div>
                <input
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Snorlax fan art t-shirt on white background…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </div>
            </Section>

            {/* ── 5. SEO Etsy ── */}
            <Section title="SEO Etsy" icon="🟠" color="orange">
              {!etsyTitle && etsyTags.length === 0 && !etsyDescription ? (
                <p className="text-gray-600 text-xs italic">Clicca 'Genera tutto con AI' per compilare →</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wider">
                        Etsy Title
                        <span className={`ml-2 font-mono ${etsyTitle.length > 140 ? 'text-red-400' : etsyTitle.length > 120 ? 'text-yellow-400' : 'text-green-500'}`}>
                          {etsyTitle.length}/140
                        </span>
                      </p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(etsyTitle); }}
                        className="border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors"
                      >⎘ Copy</button>
                    </div>
                    <textarea
                      value={etsyTitle}
                      onChange={e => setEtsyTitle(e.target.value)}
                      rows={2}
                      className="w-full bg-gray-900/50 border border-gray-800 text-gray-300 text-xs px-3 py-2 resize-none focus:outline-none focus:border-orange-700 font-mono leading-relaxed"
                    />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                      Etsy Tags
                      <span className={`ml-2 font-mono normal-case ${etsyTags.length === 13 ? 'text-green-500' : 'text-yellow-400'}`}>{etsyTags.length}/13 tags</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {etsyTags.map((tag, i) => (
                        <span key={i} className={`border text-xs px-2 py-0.5 font-mono ${tag.length > 20 ? 'border-red-800 text-red-400' : 'border-orange-900/60 text-orange-300/80'}`}>
                          {tag}
                          <span className="text-gray-700 ml-1 text-[9px]">{tag.length}</span>
                        </span>
                      ))}
                    </div>
                    <input
                      value={etsyTags.join(', ')}
                      onChange={e => setEtsyTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                      className="w-full bg-gray-900/50 border border-gray-800 text-gray-500 text-[10px] px-3 py-1.5 focus:outline-none focus:border-orange-700 font-mono mb-1"
                      placeholder="tag1, tag2, tag3..."
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(etsyTags.join(', '))}
                      className="border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors"
                    >⎘ Copy all tags</button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wider">
                        Etsy Description
                        <span className="ml-2 text-gray-600 font-mono normal-case text-[10px]">
                          ~{Math.round(etsyDescription.split(/\s+/).filter(Boolean).length)} words
                        </span>
                      </p>
                      <button
                        onClick={() => navigator.clipboard.writeText(etsyDescription)}
                        className="border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors"
                      >⎘ Copy</button>
                    </div>
                    <div className="relative">
                      <textarea
                        value={etsyDescription}
                        onChange={e => setEtsyDescription(e.target.value)}
                        rows={6}
                        className="w-full bg-gray-900/50 border border-gray-800 text-gray-400 text-xs px-3 py-2 resize-y focus:outline-none focus:border-orange-700 font-mono leading-relaxed"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/60 text-[9px] text-orange-900/70 px-1.5 py-0.5 font-mono pointer-events-none">
                        first 160: {etsyDescription.slice(0, 160).length} chars
                      </div>
                    </div>
                    <p className="text-gray-700 text-[10px] mt-1">I primi 160 chars appaiono su Google e nell'anteprima Etsy — devono essere keyword-dense.</p>
                  </div>

                  {/* Etsy Image Alt Texts */}
                  {etsyImageAlts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wider">Alt Text Immagini Etsy</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(etsyImageAlts.map((a, i) => `Img ${i + 1}: ${a}`).join('\n'))}
                          className="text-[10px] text-orange-800 hover:text-orange-600 transition-colors"
                        >📋 Copia tutte</button>
                      </div>
                      <div className="space-y-1.5">
                        {etsyImageAlts.map((alt, i) => (
                          <div key={i} className="flex items-start gap-2 group">
                            <span className="text-[10px] text-gray-700 font-mono w-5 shrink-0 pt-0.5">#{i + 1}</span>
                            <input
                              value={alt}
                              onChange={e => setEtsyImageAlts(prev => prev.map((a, j) => j === i ? e.target.value : a))}
                              className="flex-1 bg-gray-900/50 border border-gray-800 text-gray-400 text-xs px-2 py-1 focus:outline-none focus:border-orange-800 font-mono"
                            />
                            <span className={`text-[9px] font-mono shrink-0 pt-1 ${alt.length > 125 ? 'text-red-400' : alt.length > 100 ? 'text-green-500' : 'text-gray-700'}`}>
                              {alt.length}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(alt)}
                              className="text-gray-700 hover:text-orange-700 text-[10px] shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >📋</button>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-700 text-[10px] mt-1.5">Etsy consente alt text per ogni immagine — migliora accessibilità e ranking. Target 100-125 chars.</p>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* ── 6. SEO Pinterest ── */}
            <Section title="SEO Pinterest" icon="🔴" color="red">
              <Field label="Pinterest Caption">
                <textarea
                  value={pinterestCaption}
                  onChange={e => setPinterestCaption(e.target.value)}
                  rows={3}
                  placeholder="Clicca 'Genera tutto con AI' per compilare →"
                  className={`${inputCls} resize-none font-mono`}
                />
              </Field>

              {/* Pinterest 5-pack generator — each click appends 5 pins (title + text + tags) */}
              <div className="border border-red-900/40 bg-[#0a0808] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[#e60023]/80 text-xs font-semibold uppercase tracking-wider">
                    5-Pack pin AI{pinterestPins.length ? ` · ${pinterestPins.length}` : ''}
                  </p>
                  <button type="button" onClick={generatePinterestPins} disabled={generatingPins} className={`${btnGhost} text-xs`}>
                    {generatingPins ? 'Generando…' : '🔴 Genera 5 pin'}
                  </button>
                </div>
                <p className="text-[9px] text-gray-600">Ogni click aggiunge 5 pin (titolo + testo + tag). I precedenti restano. Auto-salvato.</p>
                {pinterestPins.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {pinterestPins.map((p, i) => (
                      <div key={i} className="border border-gray-800 bg-[#111] p-2 text-[11px] space-y-1 relative">
                        <button type="button" title="Rimuovi"
                          onClick={() => { const next = pinterestPins.filter((_, j) => j !== i); setPinterestPins(next); if (name.trim() && price) saveWith({ pinterestPins: next }) }}
                          className="absolute top-1 right-1 text-gray-600 hover:text-red-400 text-[10px]">✕</button>
                        {p.published && <span className="absolute top-1 right-6 text-[#e60023] text-[9px]" title="Già pubblicato su Pinterest">📌 pubblicato</span>}
                        <div className={`font-semibold pr-16 ${p.published ? 'text-gray-500' : 'text-amber-400/90'}`}>{p.title}</div>
                        <div className="text-gray-400 whitespace-pre-wrap">{p.description}</div>
                        {p.tags?.length > 0 && <div className="text-gray-600 text-[10px]">{p.tags.map(t => `#${t}`).join(' ')}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pinterest Publish Panel */}
              <div className="border border-red-900/40 bg-[#0a0808] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[#e60023] text-sm">📌</span>
                    <p className="text-[#e60023]/80 text-xs font-semibold uppercase tracking-wider">Pubblica su Pinterest</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPinterestPanel(p => !p)
                      if (!pinterestEditCaption && pinterestCaption) setPinterestEditCaption(pinterestCaption)
                    }}
                    className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                  >{showPinterestPanel ? '▲ Chiudi' : '▼ Apri'}</button>
                </div>
                {showPinterestPanel && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-gray-600 text-[10px] uppercase tracking-wider">Board</p>
                        <button onClick={fetchPinterestBoards} disabled={loadingBoards} className="text-gray-700 hover:text-gray-500 text-[9px] transition-colors">
                          {loadingBoards ? 'Caricando...' : pinterestBoards.length > 0 ? `${pinterestBoards.length} board` : '↻ Carica board'}
                        </button>
                      </div>
                      {pinterestBoards.length > 0 ? (
                        <select
                          value={pinterestBoardId}
                          onChange={e => setPinterestBoardId(e.target.value)}
                          className="w-full bg-gray-900/50 border border-gray-800 text-gray-300 text-xs px-3 py-1.5 focus:outline-none focus:border-red-800"
                        >
                          <option value="">— Scegli una board —</option>
                          {pinterestBoards.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={pinterestBoardId}
                          onChange={e => setPinterestBoardId(e.target.value)}
                          placeholder="ID board (clicca ↻ Carica board per vedere i nomi)"
                          className="w-full bg-gray-900/50 border border-gray-800 text-gray-300 text-xs px-3 py-1.5 focus:outline-none focus:border-red-800 font-mono"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-2">Immagine da usare</p>
                      {(() => {
                        const groups = [
                          { label: '🖥 Heroes', items: [
                            desktopHero && { url: desktopHero, tag: 'Desktop' },
                            mobileHero  && { url: mobileHero,  tag: 'Mobile' },
                            detailImage && { url: detailImage, tag: 'Detail' },
                          ].filter(Boolean) },
                          { label: '🖼 Gallery', items: sequenza.map((url, i) => ({ url, tag: `#${i+1}` })) },
                          { label: '⬆ Importate', items: uploadedImages.map(img => ({ url: img.url, tag: 'Import' })) },
                          { label: '✨ Generate', items: generatedImages.map(img => ({ url: img.url, tag: 'AI' })) },
                          { label: '🏭 Gelato', items: gelatoImages.map(img => ({ url: img.url, tag: 'Gelato' })) },
                        ].filter(g => g.items.length > 0)
                        return (
                          <div className="space-y-2">
                            {groups.map(g => (
                              <div key={g.label}>
                                <p className="text-gray-700 text-[9px] uppercase tracking-wider mb-1">{g.label}</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {g.items.map(o => (
                                    <button
                                      key={o.url}
                                      onClick={() => setPinterestImageChoice(o.url)}
                                      title={o.url}
                                      className={`relative w-14 h-14 border-2 overflow-hidden transition-all flex-shrink-0 ${pinterestImageChoice === o.url ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-800 hover:border-gray-600'}`}
                                    >
                                      <img src={o.url} alt="" className="w-full h-full object-cover" />
                                      <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-gray-300 text-center leading-tight py-0.5">{o.tag}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div>
                      <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">Caption pin</p>
                      <textarea
                        value={pinterestEditCaption}
                        onChange={e => setPinterestEditCaption(e.target.value)}
                        rows={3}
                        className="w-full bg-gray-900/50 border border-gray-800 text-gray-400 text-xs px-3 py-2 resize-none focus:outline-none focus:border-red-800 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={publishToPinterest}
                        disabled={pinterestPublishing}
                        className="bg-[#e60023] hover:bg-[#c9001f] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 transition-colors"
                      >{pinterestPublishing ? 'Pubblicando...' : '📌 Pubblica Pin'}</button>
                      {pinterestMsg && (
                        <span className={`text-xs ${pinterestMsg.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>{pinterestMsg}</span>
                      )}
                      {pinterestPinUrl && (
                        <a href={pinterestPinUrl} target="_blank" rel="noopener noreferrer" className="text-[#e60023] text-xs underline">Vedi Pin →</a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── 7. Social ── */}
            <Section title="Social" icon="📱" color="fuchsia">
              <SocialShareButtons
                productUrl={`https://jayl.store/product/${id}`}
                assets={[
                  ...allPoolImages.map(i => ({ url: i.url || i.src, type: 'image', alt: imageAlts[i.url || i.src] || '' })),
                  ...(videoUrl.trim() ? [{ url: videoUrl.trim(), type: 'video' }] : []),
                ]}
                title={seoTitle || name}
                tags={tags}
                altText={imageAlts[desktopHero] || imageAlts[mobileHero] || ''}
                captions={{ pinterest: pinterestCaption, instagram: instagramCaption, tiktok: tiktokCaption }}
                pins={pinterestPins}
                publishedImages={pinterestPublishedImages}
                onPinPublished={markPinterestPublished}
              />
              <Field label="Instagram Caption">
                <div className="relative">
                  <textarea
                    value={instagramCaption}
                    onChange={e => setInstagramCaption(e.target.value)}
                    rows={3}
                    placeholder="Clicca '📱 Genera SEO Social' per compilare →"
                    className={`${inputCls} resize-none font-mono`}
                  />
                  {instagramCaption && (
                    <button
                      onClick={() => navigator.clipboard.writeText(instagramCaption)}
                      className="absolute top-1.5 right-1.5 border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors bg-black/60"
                    >⎘ Copy</button>
                  )}
                </div>
              </Field>
              <Field label="TikTok Caption">
                <div className="relative">
                  <textarea
                    value={tiktokCaption}
                    onChange={e => setTiktokCaption(e.target.value)}
                    rows={2}
                    placeholder="Clicca '📱 Genera SEO Social' per compilare →"
                    className={`${inputCls} resize-none font-mono`}
                  />
                  {tiktokCaption && (
                    <button
                      onClick={() => navigator.clipboard.writeText(tiktokCaption)}
                      className="absolute top-1.5 right-1.5 border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors bg-black/60"
                    >⎘ Copy</button>
                  )}
                </div>
              </Field>
              <Field label="Hashtags (30)">
                <div className="relative">
                  <textarea
                    value={hashtags}
                    onChange={e => setHashtags(e.target.value)}
                    rows={2}
                    placeholder="Clicca '📱 Genera SEO Social' per compilare →"
                    className={`${inputCls} resize-none font-mono text-[11px]`}
                  />
                  {hashtags && (
                    <button
                      onClick={() => navigator.clipboard.writeText(hashtags)}
                      className="absolute top-1.5 right-1.5 border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors bg-black/60"
                    >⎘ Copy</button>
                  )}
                </div>
              </Field>
            </Section>

            {/* ── Video ── */}
            <Section title="Video">
              <Field label="Video URL" hint="YouTube, Vimeo, or direct .mp4 — shown as hero on the product page">
                <input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  disabled={!isEditable}
                  placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>

              {videoInfo?.type === 'youtube' && (
                <div className="relative w-48 mt-2">
                  <img
                    src={`https://img.youtube.com/vi/${videoInfo.id}/mqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full border border-gray-700"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-white text-3xl">▶</span>
                  </div>
                </div>
              )}
              {videoInfo?.type === 'vimeo' && (
                <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block mt-2">
                  ▶ Vimeo · {videoInfo.id}
                </p>
              )}
              {videoInfo?.type === 'mp4' && (
                <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block mt-2">
                  MP4 video linked
                </p>
              )}
              {videoUrl && !videoInfo && (
                <p className="text-yellow-500 text-xs mt-1">⚠ URL not recognised as YouTube, Vimeo, or .mp4</p>
              )}
            </Section>

            {/* ── Stampa & Fulfillment ── */}
            {isEditable && (
              <Section title="🖨 Stampa & Fulfillment">
                <div className="bg-amber-950/30 border border-amber-700/40 rounded p-3 mb-4">
                  <p className="text-amber-400 text-xs">
                    Gelato richiede il file di design originale (PNG/PDF ad alta risoluzione) per stampare ogni ordine.
                    Carica il file una volta sola — verrà usato per tutti gli ordini futuri.
                  </p>
                </div>

                {/* Which side Gelato will print — derived from the productUid, not the collection */}
                <div className={`mb-4 flex items-start gap-3 rounded border p-3 ${
                  placement.source === 'uid'
                    ? 'border-emerald-800/60 bg-emerald-950/20'
                    : 'border-amber-700/50 bg-amber-950/20'
                }`}>
                  <span className="text-lg leading-none">{placement.type === 'back' ? '🔙' : '👕'}</span>
                  <div className="text-xs">
                    <p className={placement.source === 'uid' ? 'text-emerald-400' : 'text-amber-400'}>
                      Lato di stampa: <strong>{placement.type === 'back' ? 'RETRO' : 'FRONTE'}</strong>
                      {' — '}{PLACEMENT_SPECS[placement.type].label}
                    </p>
                    <p className="text-gray-500 mt-0.5">
                      {placement.source === 'uid'
                        ? `Rilevato da Gelato (gpr_${placement.gpr}) — affidabile.`
                        : `Nessun codice gpr nel productUid: dedotto dalla collection "${collection || '—'}". Verifica prima di caricare.`}
                    </p>
                  </div>
                </div>

                {/* Print file */}
                <Field label="File di stampa" hint={`PNG trasparente ad alta risoluzione. Viene adattato al canvas di stampa ${PRINT_CANVAS.w}×${PRINT_CANVAS.h}.`}>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoFitDesign}
                        onChange={e => setAutoFitDesign(e.target.checked)}
                        className="accent-indigo-600"
                      />
                      Adatta automaticamente al canvas di stampa (consigliato)
                    </label>

                    {/* Staged canvas — review before committing */}
                    {designDraft && (
                      <div className="flex gap-4 rounded border border-indigo-800/60 bg-indigo-950/20 p-3">
                        <div
                          className="shrink-0 border border-dashed border-indigo-700/60 bg-[repeating-conic-gradient(#222_0_25%,#2c2c2c_0_50%)] bg-[length:16px_16px]"
                          style={{ width: 110, height: 110 * (PRINT_CANVAS.h / PRINT_CANVAS.w) }}
                        >
                          <img src={designDraft.previewUrl} alt="Anteprima di stampa" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0 text-xs space-y-1">
                          <p className="text-indigo-300 font-semibold">Anteprima di stampa — {designDraft.meta.type === 'back' ? 'RETRO' : 'FRONTE'}</p>
                          <p className="text-gray-500">Sorgente {designDraft.meta.sourceSize} · arte {designDraft.meta.artSize}</p>
                          <p className="text-gray-500">Sul canvas: {designDraft.meta.drawnSize} ({designDraft.meta.widthPct}% larghezza) · {designDraft.meta.offset}</p>
                          <p className="text-gray-600">{(designDraft.meta.bytes / 1024 / 1024).toFixed(1)} MB</p>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleConfirmDesign}
                              disabled={uploadingDesign}
                              className="bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 transition-colors"
                            >
                              {uploadingDesign ? '⏫ Caricamento…' : '✓ Conferma e carica'}
                            </button>
                            <button
                              onClick={() => setDesignDraft(null)}
                              disabled={uploadingDesign}
                              className="text-gray-500 hover:text-red-400 text-xs px-2"
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {fittingDesign && <p className="text-indigo-400 text-xs">⏳ Adattamento al canvas di stampa…</p>}

                    {printFileUrl ? (
                      <div className="flex items-center gap-3">
                        <div
                          className="shrink-0 border border-gray-800 bg-[repeating-conic-gradient(#222_0_25%,#2c2c2c_0_50%)] bg-[length:12px_12px]"
                          style={{ width: 54, height: 54 * (PRINT_CANVAS.h / PRINT_CANVAS.w) }}
                        >
                          <img src={printFileUrl} alt="File di stampa caricato" className="w-full h-full object-contain" />
                        </div>
                        <a href={printFileUrl} target="_blank" rel="noreferrer"
                           className="text-indigo-400 text-xs font-mono truncate max-w-xs hover:underline">
                          {printFileUrl.split('/').pop()}
                        </a>
                        <button onClick={() => setPrintFileUrl('')} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                      </div>
                    ) : (
                      <p className="text-amber-500 text-xs italic">
                        ⚠ Nessun file caricato — il prodotto non è vendibile: l’ordine viene rifiutato dopo il pagamento.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <label className={`cursor-pointer ${uploadingDesign || fittingDesign ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,application/pdf,image/svg+xml"
                          className="hidden"
                          onChange={e => { handlePickDesign(e.target.files?.[0]); e.target.value = '' }}
                        />
                        <span className="inline-block bg-indigo-800 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 transition-colors">
                          {uploadingDesign ? '⏫ Caricamento…' : fittingDesign ? '⏳ Adatto…' : '⬆ Carica design'}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={printFileUrl}
                        onChange={e => setPrintFileUrl(e.target.value)}
                        placeholder="oppure incolla URL…"
                        className={`${inputCls} text-xs flex-1`}
                      />
                    </div>
                    {designUploadErr && <p className="text-red-400 text-xs">⚠ {designUploadErr}</p>}
                  </div>
                </Field>

                {/* Neck label */}
                <Field label="Neck Label (colletto)" hint="Etichetta interna — richiesta per prodotti con 'inlbl' nel productUid.">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNeckLabelUrl(JAYL_NECK_LABEL_URL)}
                        className="bg-amber-900/40 hover:bg-amber-800/50 border border-amber-800/60 text-amber-400 text-xs px-3 py-1.5 transition-colors whitespace-nowrap"
                      >
                        👕 Logo JAYL
                      </button>
                      <input
                        type="text"
                        value={neckLabelUrl}
                        onChange={e => setNeckLabelUrl(e.target.value)}
                        placeholder="URL neck label…"
                        className={`${inputCls} text-xs flex-1`}
                      />
                      {neckLabelUrl && (
                        <button onClick={() => setNeckLabelUrl('')} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                      )}
                    </div>
                    {neckLabelUrl && (
                      <p className="text-green-500 text-xs">✓ {neckLabelUrl === JAYL_NECK_LABEL_URL ? 'Logo JAYL preimpostato' : 'Custom URL'}</p>
                    )}
                  </div>
                </Field>
              </Section>
            )}

            {/* ── Gelato ── */}
            <Section title="Gelato">
              <Field label="Gelato Product UID" hint="Used to route orders to the correct Gelato product">
                <input
                  value={gelatoUid}
                  onChange={e => setGelatoUid(e.target.value.replace(/[^\x20-\x7E]/g, '').trim())}
                  disabled={!isEditable}
                  className={`${inputCls} font-mono text-xs${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>


              {/* Sincronizza Gelato */}
              {isEditable && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <button
                    onClick={() => syncGelato(false)}
                    disabled={syncing || !gelatoUid.trim()}
                    className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white px-3 py-2 text-xs font-semibold transition-colors"
                  >
                    {syncing ? 'Sincronizzando…' : '🔄 Sync Gelato'}
                  </button>
                  <button
                    onClick={() => syncGelato(true)}
                    disabled={syncing || !gelatoUid.trim()}
                    className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-2 text-xs font-semibold transition-colors"
                  >
                    {syncing ? 'Salvando…' : '🔄 Re-sync & Save'}
                  </button>
                  {syncMsg && <span className="text-xs text-gray-400">{syncMsg}</span>}
                </div>
              )}

              {/* Sizes read-only */}
              {product.sizes?.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Sizes</p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(s => (
                      <span key={s.id} className="border border-gray-700 text-gray-400 text-xs px-3 py-1">
                        {s.label} · {fmt(s.price)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variants read-only */}
              {product.variants?.length > 0 && (
                <Collapsible label={`${product.variants.length} variant${product.variants.length !== 1 ? 's' : ''}`} defaultOpen={false}>
                  <div className="overflow-x-auto scrollbar-hide max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-gray-600 border-b border-gray-800">
                          <th className="pb-1.5 pr-3">Color</th>
                          <th className="pb-1.5 pr-3">Size</th>
                          <th className="pb-1.5">Gelato variant UID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map((v, i) => (
                          <tr key={i} className="border-b border-gray-800/40 text-gray-400">
                            <td className="py-1 pr-3">{v.color || v.id || '—'}</td>
                            <td className="py-1 pr-3">{v.size || '—'}</td>
                            <td className="py-1 font-mono text-gray-600 text-xs truncate max-w-xs">
                              {v.gelatoVariantId || v.uid || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Collapsible>
              )}
            </Section>

            {/* ── Save (bottom) ── */}
            {isEditable && (
              <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-8 py-3 text-sm font-semibold transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {/* Save & Launch */}
                <button
                  onClick={handleSaveAndLaunch}
                  disabled={saveLaunching || !name.trim()}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  {saveLaunching ? saveLaunchStatus : '🚀 Salva & Lancia'}
                </button>
                {saveLaunchStatus && !saveLaunching && (
                  <span className="text-xs text-amber-400">{saveLaunchStatus}</span>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={btnDanger}
                >
                  {deleting ? 'Deleting…' : 'Delete Product'}
                </button>
                {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
                {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
              </div>
            )}

            {/* ── Generate Assets (collapsed by default) ── */}
            <div className="border border-gray-800">
              <Collapsible label="🎨 Generate Assets — mockup, video AI" defaultOpen={false}>
                <div className="mt-0">
                  <GenerateAssetsTab
                    productId={id}
                    productName={name}
                    productType={section === 'art' ? 'art print' : 'apparel/object'}
                    primaryColor={product?.variants?.[0]?.color || ''}
                    collection={collection}
                    onAssetSaved={() => setPoolRefreshKey(k => k + 1)}
                    preloadedImages={allPoolImages}
                  />
                </div>
              </Collapsible>
            </div>

            {/* ── Remove Background (collapsed by default) ── */}
            <div className="border border-gray-800">
              <Collapsible label="✂ Remove Background — rimuovi sfondo da immagine" defaultOpen={false}>
                <RemoveBackground />
              </Collapsible>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
