import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { upload as blobUpload } from '@vercel/blob/client'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { products as allProducts } from '@/data/products'
import GenerateAssetsTab from '@/components/GenerateAssetsTab'

const ADMIN_PASSWORD = 'jaylpelle'
const JAYL_NECK_LABEL_URL = 'https://raw.githubusercontent.com/pellegrinottijoshua-hash/jayl-store/main/public/designs/jayl-neck-label.svg'

// ── Helpers ───────────────────────────────────────────────────────────────────

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
    body: JSON.stringify({ action, password: ADMIN_PASSWORD, ...data }),
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
const btnPrimary = 'bg-[#e8dcc8] hover:bg-white disabled:opacity-40 text-black px-4 py-2 text-sm font-semibold transition-colors cursor-pointer'
const btnDanger  = 'bg-red-900/70 hover:bg-red-800 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnGhost   = 'border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-3 py-1.5 text-xs transition-colors cursor-pointer'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[#888] text-xs mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[#666] text-xs mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      {title && (
        <p className="text-[#666] text-xs font-mono uppercase tracking-widest border-b border-[#1a1a1a] pb-2">
          {title}
        </p>
      )}
      {children}
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
  productId, onUploaded, loading,
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
    if (!img.path) return
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
  }, [desktopHero, mobileHero, detailImage, sequenza, onSetDesktopHero, onSetMobileHero, onSetDetailImage, onToggleSequenza, onUploaded])

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
            className="w-full bg-gray-800 border border-gray-700 text-white text-xs px-3 py-2 focus:outline-none focus:border-purple-500 font-mono"
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
  const [featured, setFeatured]     = useState(false)  // 1 | 2 | false
  const [featuringNow, setFeaturingNow] = useState(false)
  const [relatedProducts, setRelatedProducts] = useState([])

  // Status
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const [saveErr, setSaveErr]       = useState('')
  const [deleting, setDeleting]     = useState(false)

  // AI generation
  const [generating, setGenerating]             = useState(false)
  const [genErr, setGenErr]                     = useState('')
  const [aiProvider, setAiProvider]             = useState('openai')
  // AI social/SEO output
  const [instagramCaption, setInstagramCaption] = useState('')
  const [pinterestCaption, setPinterestCaption] = useState('')
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
      setImageAlts(p.imageAlts && typeof p.imageAlts === 'object' ? p.imageAlts : {})
      setEtsyTitle(p.etsyTitle || '')
      setEtsyTags(Array.isArray(p.etsyTags) ? p.etsyTags : [])
      setEtsyDescription(p.etsyDescription || '')
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
    ;(product?.images || []).forEach(u => { if (u && !u.includes('raw.githubusercontent.com')) add(u) })
    if (product?.image     && !product.image.includes('raw.githubusercontent.com'))     add(product.image)
    if (product?.heroImage && !product.heroImage.includes('raw.githubusercontent.com')) add(product.heroImage)
    return [...urls].map(url => ({ url, name: url.split('/').pop().split('?')[0] || 'image' }))
  }, [product])

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
      if (data.tags?.length) setTags(data.tags.join(', '))
      if (data.instagramCaption) setInstagramCaption(data.instagramCaption)
      if (data.pinterestCaption) setPinterestCaption(data.pinterestCaption)
      if (data.hashtags)         setHashtags(data.hashtags)
      if (data.primaryKeywords?.length)  setPrimaryKeywords(data.primaryKeywords)
      if (data.longTailKeywords?.length) setLongTailKeywords(data.longTailKeywords)
      if (data.etsyTitle)        setEtsyTitle(data.etsyTitle)
      if (data.etsyTags?.length) setEtsyTags(data.etsyTags)
      if (data.etsyDescription)  setEtsyDescription(data.etsyDescription)
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGenerating(false)
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
      const res = await fetch('/api/generate-alts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim() || 'JAYL product', movement, collection, images: imageEntries, provider: aiProvider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Alt text generation failed')
      setImageAlts(prev => ({ ...prev, ...data.alts }))
      const count = Object.keys(data.alts || {}).length
      setAltsMsg(`✓ ${count} alt text${count !== 1 ? 's' : ''} generati`)
      setTimeout(() => setAltsMsg(''), 4000)
    } catch (e) {
      setAltsMsg('⚠ ' + e.message)
    } finally {
      setGeneratingAlts(false)
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
          password:    'jaylpelle',
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

  const handleSave = async () => {
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
        ...(etsyTitle.trim()       ? { etsyTitle:       etsyTitle.trim() }       : {}),
        ...(etsyTags.length > 0    ? { etsyTags:        etsyTags }               : {}),
        ...(etsyDescription.trim() ? { etsyDescription: etsyDescription.trim() } : {}),
        ...(seoTitle.trim() ? { seoTitle: seoTitle.trim() } : {}),
      }
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

  const handleUploadDesign = async (file) => {
    if (!file) return
    setUploadingDesign(true); setDesignUploadErr('')
    try {
      // Try Vercel Blob client upload for large files
      const sanitized = sanitizeFilename(file.name)
      const blob = await blobUpload(sanitized, file, {
        access: 'public',
        handleUploadUrl: '/api/admin',
        clientPayload: JSON.stringify({ password: ADMIN_PASSWORD, productId: id }),
      })
      const result = await api('upload-design', { productId: id, filename: sanitized, blobUrl: blob.url })
      setPrintFileUrl(result.url)
    } catch {
      // Fallback: base64 for smaller files
      try {
        const dataUrl = await fileToBase64(file)
        const sanitized = sanitizeFilename(file.name)
        const result = await api('upload-design', { productId: id, filename: sanitized, dataUrl })
        setPrintFileUrl(result.url)
      } catch (e2) {
        setDesignUploadErr(e2.message || 'Upload failed')
      }
    } finally {
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
            />

            {/* Image status summary */}
            <div className="bg-[#0a0a0a] border border-gray-800/60 px-3 py-2 space-y-1 text-[11px] text-gray-600">
              {desktopHero && <div className="flex items-center gap-1.5"><span className="text-blue-400">🖥</span><span className="text-gray-500 truncate">Hero desktop assegnato</span></div>}
              {mobileHero  && <div className="flex items-center gap-1.5"><span className="text-purple-400">📱</span><span className="text-gray-500 truncate">Hero mobile assegnato</span></div>}
              {detailImage && <div className="flex items-center gap-1.5"><span className="text-amber-400">🔍</span><span className="text-gray-500 truncate">Dettaglio assegnato</span></div>}
              {sequenza.length > 0 && <div className="flex items-center gap-1.5"><span>🖼</span><span className="text-gray-500">{sequenza.length} immagini in sequenza</span></div>}
              {Object.keys(imageAlts).length > 0 && <div className="flex items-center gap-1.5"><span className="text-violet-400">✨</span><span className="text-gray-500">{Object.keys(imageAlts).length} alt text pronti</span></div>}
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

            {/* ── Name + AI ── */}
            <Section title="Title">
              <Field label="Product name" hint={`id: ${id}`}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isEditable}
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>
              {isEditable && (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <button
                    onClick={generateWithAI}
                    disabled={generating || !name.trim()}
                    className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    {generating ? (
                      <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> Generating…</>
                    ) : (
                      <>✨ Regenerate with AI</>
                    )}
                  </button>
                  <select
                    value={aiProvider}
                    onChange={e => setAiProvider(e.target.value)}
                    disabled={generating}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer disabled:opacity-40"
                    title="AI text provider"
                  >
                    <option value="openai">GPT-4o mini</option>
                    <option value="longcat-flash">Longcat Flash</option>
                    <option value="longcat-thinking">Longcat Thinking</option>
                  </select>
                  {genErr && <span className="text-red-400 text-xs">{genErr}</span>}
                  {!genErr && !generating && altText && description && (
                    <span className="text-violet-400 text-xs">✓ AI content applied</span>
                  )}
                </div>
              )}
            </Section>

            {/* ── Pricing & meta ── */}
            <Section title="Pricing & Categorisation">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price (€)">
                  <input
                    type="number" min="0" step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>

                <Field label="Section">
                  <select
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  >
                    <option value="objects">objects</option>
                    <option value="art">art</option>
                  </select>
                </Field>

                <Field label="Collection">
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

              {/* ── Related / Upsell products ── */}
              {isEditable && (
                <Field label="Complete the Look — Related Products" hint="Up to 4 products shown as upsell at the bottom of this product page">
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

            {/* ── Description ── */}
            <Section title="Copy">
              <Field label="Description" hint="~150 words · shown in the About accordion on the product page">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!isEditable}
                  rows={6}
                  className={`${inputCls} resize-y${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>

              <Field label="Alt text" hint="1 sentence · shown to screen readers and used for SEO image indexing">
                <input
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Snorlax fan art t-shirt on white background…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>

              {/* ── Per-image alt text generator ── */}
              {isEditable && (
                <div className="border border-violet-900/40 bg-[#0d0d0f] p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-violet-300 text-xs font-semibold mb-0.5">✨ Alt text AI per immagine</p>
                      <p className="text-gray-600 text-[11px]">
                        Genera alt text descrittivi per ogni immagine nel pool (hero, sequenza, dettaglio).
                        Vengono salvati con il prodotto e usati per SEO e accessibilità.
                      </p>
                    </div>
                    <button
                      onClick={generateAlts}
                      disabled={generatingAlts}
                      className="flex items-center gap-1.5 bg-violet-800 hover:bg-violet-700 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0"
                    >
                      {generatingAlts
                        ? <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> Generando…</>
                        : `✨ Genera alt text${allPoolImages.length ? ` (${[desktopHero, mobileHero, detailImage, ...sequenza].filter(Boolean).length + allPoolImages.filter(img => ![desktopHero, mobileHero, detailImage, ...sequenza].includes(img.url)).length} immagini)` : ''}`
                      }
                    </button>
                  </div>
                  {altsMsg && (
                    <p className={`text-xs ${altsMsg.startsWith('✓') ? 'text-violet-300' : 'text-red-400'}`}>{altsMsg}</p>
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
              )}

              <Field
                label="Tags"
                hint={`${tags.split(',').filter(t => t.trim()).length}/13 tags · comma-separated · each max 20 chars`}
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

            {/* ── Social & SEO ── */}
            {(instagramCaption || pinterestCaption || hashtags || primaryKeywords.length > 0 || etsyTitle || seoTitle) && (
              <Section title="Social & SEO">
                <div className="space-y-5">

                  {/* seoTitle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wider">
                        SEO Title
                        <span className={`ml-2 font-mono ${seoTitle.length > 70 ? 'text-yellow-400' : 'text-green-500'}`}>
                          {seoTitle.length}/70
                        </span>
                      </p>
                      <span className="text-gray-700 text-[10px]">meta title · usePageMeta aggiunge "— JAYL"</span>
                    </div>
                    <input
                      value={seoTitle}
                      onChange={e => setSeoTitle(e.target.value)}
                      placeholder="Mewtwo Pokemon T-Shirt | Retro 90s Anime Fan Gift"
                      className="w-full bg-gray-900/50 border border-gray-800 text-gray-300 text-xs px-3 py-2 focus:outline-none focus:border-blue-700 font-mono"
                    />
                  </div>

                  {/* ── Etsy SEO ── */}
                  {(etsyTitle || etsyTags.length > 0 || etsyDescription) && (
                    <div className="border border-gray-800/60 bg-[#0a0f0a] p-3 space-y-3">
                      <p className="text-[#f1641e]/80 text-xs font-semibold uppercase tracking-wider">🛍 Etsy SEO</p>
                      {etsyTitle && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-gray-600 text-[10px] uppercase tracking-wider">
                              Titolo Etsy
                              <span className={`ml-2 font-mono ${etsyTitle.length > 140 ? 'text-red-400' : etsyTitle.length > 100 ? 'text-yellow-400' : 'text-green-500'}`}>
                                {etsyTitle.length}/140
                              </span>
                            </p>
                          </div>
                          <input
                            value={etsyTitle}
                            onChange={e => setEtsyTitle(e.target.value)}
                            className="w-full bg-gray-900/50 border border-gray-800 text-gray-300 text-xs px-3 py-2 focus:outline-none focus:border-orange-700 font-mono"
                          />
                        </div>
                      )}
                      {etsyTags.length > 0 && (
                        <div>
                          <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">
                            Tag Etsy
                            <span className={`ml-2 font-mono ${etsyTags.length === 13 ? 'text-green-500' : 'text-yellow-400'}`}>{etsyTags.length}/13</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {etsyTags.map((t, i) => (
                              <span key={i} className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 font-mono">{t}</span>
                            ))}
                          </div>
                          <input
                            value={etsyTags.join(', ')}
                            onChange={e => setEtsyTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                            className="w-full bg-gray-900/50 border border-gray-800 text-gray-500 text-[10px] px-3 py-1.5 focus:outline-none focus:border-orange-700 font-mono"
                            placeholder="tag1, tag2, tag3..."
                          />
                        </div>
                      )}
                      {etsyDescription && (
                        <CopyBlock label="Descrizione Etsy" value={etsyDescription} rows={5} />
                      )}
                    </div>
                  )}

                  {instagramCaption && (
                    <CopyBlock label="Instagram caption" value={instagramCaption} rows={3} />
                  )}
                  {pinterestCaption && (
                    <CopyBlock label="Pinterest caption" value={pinterestCaption} rows={3} />
                  )}

                  {/* ── Pinterest Publish Panel ── */}
                  <div className="border border-[#1a1a2e] bg-[#0a0a14] p-4 space-y-3">
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

                  {hashtags && (
                    <CopyBlock label="Hashtags (30)" value={hashtags} rows={2} />
                  )}
                  {primaryKeywords.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Primary keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {primaryKeywords.map(kw => (
                          <span key={kw} className="border border-gray-700 text-gray-400 text-xs px-2 py-0.5">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {longTailKeywords.length > 0 && (
                    <Collapsible label={`${longTailKeywords.length} long-tail keywords`}>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {longTailKeywords.map(kw => (
                          <span key={kw} className="border border-gray-800 text-gray-500 text-xs px-2 py-0.5">{kw}</span>
                        ))}
                      </div>
                    </Collapsible>
                  )}

                  {/* ── Etsy SEO ── */}
                  {(etsyTitle || etsyTags.length > 0 || etsyDescription) && (
                    <div className="border border-orange-900/50 bg-[#0d0a08] p-4 space-y-4">
                      <div className="flex items-center gap-2 border-b border-orange-900/30 pb-2">
                        <span className="text-orange-400 text-sm">🏪</span>
                        <p className="text-orange-300 text-xs font-semibold uppercase tracking-wider">SEO Etsy</p>
                        <span className="text-gray-700 text-xs ml-auto">2025 NLP algorithm</span>
                      </div>

                      {etsyTitle && (
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
                      )}

                      {etsyTags.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                            Etsy Tags
                            <span className="ml-2 text-gray-600 font-mono normal-case">{etsyTags.length}/13 tag{etsyTags.length !== 1 ? 's' : ''}</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {etsyTags.map((tag, i) => (
                              <span key={i} className={`border text-xs px-2 py-0.5 font-mono ${tag.length > 20 ? 'border-red-800 text-red-400' : 'border-orange-900/60 text-orange-300/80'}`}>
                                {tag}
                                <span className="text-gray-700 ml-1 text-[9px]">{tag.length}</span>
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(etsyTags.join(', '))}
                            className="border border-[#252525] hover:border-[#444] text-[#777] hover:text-[#e8dcc8] px-2 py-0.5 text-[10px] transition-colors"
                          >⎘ Copy all tags</button>
                        </div>
                      )}

                      {etsyDescription && (
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
                              rows={8}
                              className="w-full bg-gray-900/50 border border-gray-800 text-gray-400 text-xs px-3 py-2 resize-y focus:outline-none focus:border-orange-700 font-mono leading-relaxed"
                            />
                            <div className="absolute bottom-2 right-2 bg-black/60 text-[9px] text-orange-900/70 px-1.5 py-0.5 font-mono pointer-events-none">
                              first 160: {etsyDescription.slice(0, 160).length} chars
                            </div>
                          </div>
                          <p className="text-gray-700 text-[10px] mt-1">I primi 160 chars appaiono su Google e nell'anteprima Etsy — devono essere keyword-dense.</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </Section>
            )}

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

                {/* Print file */}
                <Field label="File di stampa" hint="PNG/PDF alta risoluzione (almeno 300 DPI). Questo è il design che Gelato stampa sulla maglietta.">
                  <div className="space-y-2">
                    {printFileUrl ? (
                      <div className="flex items-center gap-2">
                        <a href={printFileUrl} target="_blank" rel="noreferrer"
                           className="text-indigo-400 text-xs font-mono truncate max-w-xs hover:underline">
                          {printFileUrl.split('/').pop()}
                        </a>
                        <button onClick={() => setPrintFileUrl('')} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                      </div>
                    ) : (
                      <p className="text-gray-600 text-xs italic">Nessun file caricato</p>
                    )}
                    <div className="flex gap-2">
                      <label className={`cursor-pointer ${uploadingDesign ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,application/pdf,image/svg+xml"
                          className="hidden"
                          onChange={e => handleUploadDesign(e.target.files?.[0])}
                        />
                        <span className="inline-block bg-indigo-800 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 transition-colors">
                          {uploadingDesign ? '⏫ Caricamento…' : '⬆ Carica design'}
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
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xs px-3 py-1.5 transition-colors whitespace-nowrap"
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
